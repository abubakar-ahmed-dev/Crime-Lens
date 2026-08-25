# Repository Analysis Prompt

You are a senior software engineer, software architect, and technical writer.

Your first task is to thoroughly understand this repository before generating any documentation or making any changes.

## Instructions

* Read and analyze the entire repository.
* Do **not** modify any files.
* Do **not** generate documentation yet.
* Do **not** make assumptions or invent functionality.
* Base every conclusion only on the code, configuration files, database schema, and project structure.
* If something cannot be determined confidently, explicitly state that it is unknown instead of guessing.

## Analyze the following

1. Project purpose

   * What problem does this project solve?
   * Who are its intended users?

2. Technology stack

   * Languages
   * Frameworks
   * Database
   * Authentication
   * Third-party services
   * Important libraries

3. High-level architecture

   * Overall system design
   * Major modules
   * Responsibilities of each module
   * How the modules interact

4. Project structure

   * Explain the purpose of the main directories.
   * Identify important entry points.

5. Application flow

   * Explain how a typical request flows through the system.
   * Include routes, middleware, controllers, services, repositories/models, and database interactions if applicable.

6. Database

   * Identify the database technology.
   * Summarize the schema.
   * Identify relationships between entities.

7. Authentication & Authorization

   * Explain how users authenticate.
   * Explain roles and permissions if implemented.

8. API

   * Summarize the available APIs.
   * Group endpoints by feature or module.

9. Configuration

   * Identify important configuration files.
   * List required environment variables and explain their purpose if determinable.

10. Missing or unclear areas

* List anything that cannot be determined from the code.
* List any inconsistencies or areas that may require clarification.

## Output

Produce a concise but comprehensive project analysis report in Markdown.
