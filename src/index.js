#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const env = readEnv();
const jiraClient = createJiraClient(env);

const server = new McpServer({
  name: "jira-mcp",
  version: "0.1.0"
});

server.tool(
  "get_issue",
  "Get a Jira issue with core fields and status.",
  {
    issue_key: z.string().min(1)
  },
  async ({ issue_key }) => {
    const issue = await jiraClient.getIssue(issue_key);
    return textResult(JSON.stringify(issue, null, 2));
  }
);

server.tool(
  "list_transitions",
  "List available transitions for a Jira issue.",
  {
    issue_key: z.string().min(1)
  },
  async ({ issue_key }) => {
    const transitions = await jiraClient.listTransitions(issue_key);
    return textResult(JSON.stringify(transitions, null, 2));
  }
);

server.tool(
  "transition_issue",
  "Move a Jira issue to another workflow state using a transition id.",
  {
    issue_key: z.string().min(1),
    transition_id: z.string().min(1)
  },
  async ({ issue_key, transition_id }) => {
    await jiraClient.transitionIssue(issue_key, transition_id);
    return textResult(
      `Issue ${issue_key} transitioned successfully with transition id ${transition_id}.`
    );
  }
);

server.tool(
  "add_comment",
  "Add a plain text comment to a Jira issue.",
  {
    issue_key: z.string().min(1),
    comment: z.string().min(1)
  },
  async ({ issue_key, comment }) => {
    await jiraClient.addComment(issue_key, comment);
    return textResult(`Comment added successfully to ${issue_key}.`);
  }
);

server.tool(
  "update_issue_description",
  "Update the description of a Jira issue using plain text. Pass an empty string to clear it.",
  {
    issue_key: z.string().min(1),
    description: z.string()
  },
  async ({ issue_key, description }) => {
    await jiraClient.updateIssueDescription(issue_key, description);
    return textResult(`Description updated successfully for ${issue_key}.`);
  }
);

server.tool(
  "append_issue_description",
  "Append plain text to the current description of a Jira issue.",
  {
    issue_key: z.string().min(1),
    text: z.string().min(1)
  },
  async ({ issue_key, text }) => {
    await jiraClient.appendIssueDescription(issue_key, text);
    return textResult(`Description appended successfully for ${issue_key}.`);
  }
);

server.tool(
  "search_issues",
  "Search Jira issues using JQL.",
  {
    jql: z.string().min(1),
    max_results: z.number().int().positive().max(100).optional()
  },
  async ({ jql, max_results }) => {
    const result = await jiraClient.searchIssues(jql, max_results ?? 20);
    return textResult(JSON.stringify(result, null, 2));
  }
);

server.tool(
  "find_user",
  "Find Jira users by name or email and return their account ids.",
  {
    query: z.string().min(1),
    max_results: z.number().int().positive().max(20).optional()
  },
  async ({ query, max_results }) => {
    const result = await jiraClient.findUser(query, max_results ?? 10);
    return textResult(JSON.stringify(result, null, 2));
  }
);

server.tool(
  "create_issue",
  "Create a Jira issue with an optional assignee account id.",
  {
    project_key: z.string().min(1),
    issue_type: z.string().min(1),
    summary: z.string().min(1),
    description: z.string().optional(),
    assignee_account_id: z.string().optional()
  },
  async ({
    project_key,
    issue_type,
    summary,
    description,
    assignee_account_id
  }) => {
    const issue = await jiraClient.createIssue({
      projectKey: project_key,
      issueType: issue_type,
      summary,
      description,
      assigneeAccountId: assignee_account_id
    });

    return textResult(JSON.stringify(issue, null, 2));
  }
);

server.tool(
  "assign_issue",
  "Assign an existing Jira issue to a user account id.",
  {
    issue_key: z.string().min(1),
    assignee_account_id: z.string().min(1)
  },
  async ({ issue_key, assignee_account_id }) => {
    await jiraClient.assignIssue(issue_key, assignee_account_id);
    return textResult(`Issue ${issue_key} assigned successfully.`);
  }
);

server.tool(
  "update_issue_summary",
  "Update the summary (title) of a Jira issue.",
  {
    issue_key: z.string().min(1),
    summary: z.string().min(1)
  },
  async ({ issue_key, summary }) => {
    await jiraClient.updateIssueSummary(issue_key, summary);
    return textResult(`Summary updated successfully for ${issue_key}.`);
  }
);

server.tool(
  "update_issue_labels",
  "Replace the labels of a Jira issue with the provided list. Pass an empty array to clear all labels.",
  {
    issue_key: z.string().min(1),
    labels: z.array(z.string()).min(0)
  },
  async ({ issue_key, labels }) => {
    await jiraClient.updateIssueLabels(issue_key, labels);
    return textResult(`Labels updated successfully for ${issue_key}.`);
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

function readEnv() {
  const required = ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  return {
    baseUrl: trimTrailingSlash(process.env.JIRA_BASE_URL),
    email: process.env.JIRA_EMAIL,
    apiToken: process.env.JIRA_API_TOKEN
  };
}

function createJiraClient(envConfig) {
  const authHeader = `Basic ${Buffer.from(
    `${envConfig.email}:${envConfig.apiToken}`
  ).toString("base64")}`;

  async function request(path, options = {}) {
    const response = await fetch(`${envConfig.baseUrl}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: authHeader,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });

    if (!response.ok) {
      const body = await safeReadBody(response);
      throw new Error(
        `Jira API request failed (${response.status} ${response.statusText}) for ${path}: ${body}`
      );
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  return {
    async getIssue(issueKey) {
      const data = await request(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,status,issuetype,assignee,reporter,priority,description`
      );

      return {
        key: data.key,
        id: data.id,
        summary: data.fields?.summary ?? null,
        description: extractPlainText(data.fields?.description),
        status: data.fields?.status?.name ?? null,
        issueType: data.fields?.issuetype?.name ?? null,
        priority: data.fields?.priority?.name ?? null,
        assignee: data.fields?.assignee?.displayName ?? null,
        reporter: data.fields?.reporter?.displayName ?? null,
        url: `${envConfig.baseUrl}/browse/${data.key}`
      };
    },

    async listTransitions(issueKey) {
      const data = await request(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`
      );

      return {
        issueKey,
        transitions: (data.transitions ?? []).map((transition) => ({
          id: transition.id,
          name: transition.name,
          toStatus: transition.to?.name ?? null
        }))
      };
    },

    async transitionIssue(issueKey, transitionId) {
      await request(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
        {
          method: "POST",
          body: JSON.stringify({
            transition: {
              id: transitionId
            }
          })
        }
      );
    },

    async addComment(issueKey, comment) {
      await request(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
        {
          method: "POST",
          body: JSON.stringify({
            body: buildTextDocument(comment)
          })
        }
      );
    },

    async searchIssues(jql, maxResults) {
      const data = await request("/rest/api/3/search/jql", {
        method: "POST",
        body: JSON.stringify({
          jql,
          maxResults,
          fields: ["summary", "status", "issuetype", "assignee", "priority"]
        })
      });

      return {
        total: data.total ?? 0,
        issues: (data.issues ?? []).map((issue) => ({
          key: issue.key,
          summary: issue.fields?.summary ?? null,
          status: issue.fields?.status?.name ?? null,
          issueType: issue.fields?.issuetype?.name ?? null,
          priority: issue.fields?.priority?.name ?? null,
          assignee: issue.fields?.assignee?.displayName ?? null,
          url: `${envConfig.baseUrl}/browse/${issue.key}`
        }))
      };
    },

    async findUser(query, maxResults) {
      const params = new URLSearchParams({
        query,
        maxResults: String(maxResults)
      });

      const data = await request(
        `/rest/api/3/user/search?${params.toString()}`
      );

      return {
        total: data.length,
        users: data.map((user) => ({
          accountId: user.accountId,
          displayName: user.displayName ?? null,
          emailAddress: user.emailAddress ?? null,
          active: user.active ?? null
        }))
      };
    },

    async createIssue({
      projectKey,
      issueType,
      summary,
      description,
      assigneeAccountId
    }) {
      const fields = {
        project: {
          key: projectKey
        },
        issuetype: {
          name: issueType
        },
        summary
      };

      if (description) {
        fields.description = buildTextDocument(description);
      }

      if (assigneeAccountId) {
        fields.assignee = {
          accountId: assigneeAccountId
        };
      }

      const data = await request("/rest/api/3/issue", {
        method: "POST",
        body: JSON.stringify({ fields })
      });

      return {
        id: data.id,
        key: data.key,
        url: `${envConfig.baseUrl}/browse/${data.key}`
      };
    },

    async assignIssue(issueKey, assigneeAccountId) {
      await request(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
        method: "PUT",
        body: JSON.stringify({
          fields: {
            assignee: {
              accountId: assigneeAccountId
            }
          }
        })
      });
    },

    async updateIssueDescription(issueKey, description) {
      await request(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
        method: "PUT",
        body: JSON.stringify({
          fields: {
            description: description.length > 0 ? buildTextDocument(description) : null
          }
        })
      });
    },

    async appendIssueDescription(issueKey, text) {
      const issue = await this.getIssue(issueKey);
      const description = appendText(issue.description, text);
      await this.updateIssueDescription(issueKey, description);
    },

    async updateIssueSummary(issueKey, summary) {
      await request(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
        method: "PUT",
        body: JSON.stringify({
          fields: { summary }
        })
      });
    },

    async updateIssueLabels(issueKey, labels) {
      await request(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
        method: "PUT",
        body: JSON.stringify({
          fields: { labels }
        })
      });
    }
  };
}

function textResult(text) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function buildTextDocument(text) {
  return {
    type: "doc",
    version: 1,
    content: text.split(/\r?\n/).map((line) => ({
      type: "paragraph",
      ...(line.length > 0
        ? {
            content: [
              {
                type: "text",
                text: line
              }
            ]
          }
        : {})
    }))
  };
}

function extractPlainText(document) {
  if (!document || !Array.isArray(document.content)) {
    return "";
  }

  return document.content
    .filter((node) => node?.type === "paragraph")
    .map((paragraph) =>
      Array.isArray(paragraph.content)
        ? paragraph.content
            .filter((node) => node?.type === "text")
            .map((node) => node.text ?? "")
            .join("")
        : ""
    )
    .join("\n");
}

function appendText(currentText, textToAppend) {
  if (!currentText) {
    return textToAppend;
  }

  return `${currentText}\n${textToAppend}`;
}

async function safeReadBody(response) {
  try {
    return await response.text();
  } catch {
    return "<unable to read response body>";
  }
}
