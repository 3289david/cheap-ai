import type { ToolDefinition } from './types';

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read (relative or absolute)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file with the given content',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Make a targeted edit to a file by replacing old_str with new_str',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to edit' },
          old_str: { type: 'string', description: 'Exact text to replace' },
          new_str: { type: 'string', description: 'Text to replace it with' },
        },
        required: ['path', 'old_str', 'new_str'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and directories in a path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list (default: current directory)' },
          recursive: { type: 'string', description: 'Whether to list recursively (true/false)', enum: ['true', 'false'] },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a file or empty directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File or directory path to delete' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for text in files using grep-style search',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern or text to find' },
          path: { type: 'string', description: 'Directory to search in (default: current)' },
          file_pattern: { type: 'string', description: 'File glob pattern (e.g. "*.ts", "*.py")' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_command',
      description: 'Execute a shell command in the project directory. Use for npm install, git, builds, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
          timeout: { type: 'string', description: 'Timeout in seconds (default: 60)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_directory',
      description: 'Create a directory (including nested directories)',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to create' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_file',
      description: 'Move or rename a file or directory',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Source path' },
          to: { type: 'string', description: 'Destination path' },
        },
        required: ['from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_info',
      description: 'Get information about the current project (package.json, tech stack, structure)',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deploy_project',
      description: 'Deploy the current project to get a live URL',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Deploy type',
            enum: ['docker', 'static', 'node', 'python'],
          },
          port: { type: 'string', description: 'Port to expose (default: auto)' },
          subdomain: { type: 'string', description: 'Subdomain to use (auto-generated if not specified)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember',
      description: 'Save a fact or note about the project to memory for future sessions',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The fact or note to remember about this project' },
          category: {
            type: 'string',
            description: 'Category of memory',
            enum: ['architecture', 'feature', 'bug', 'preference', 'credential', 'general'],
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch content from a URL (docs, APIs, web pages)',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
        },
        required: ['url'],
      },
    },
  },
];

export const TOOL_NAMES = AGENT_TOOLS.map(t => t.function.name);
