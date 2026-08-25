# Agent Rules

## Code Rules

Use the Foundry VTT Code Style as defined in the [Foundry VTT Code Style](foundry-CodeRules.md).

Build using modern architecture patterns and best practices. 

Build using Foundry VTT's architecture patterns and best practices. 

Do not rebuild complex logic in Foundry VTT's codebase. Use the Foundry VTT API to interact with the game world.  

Do not rebuild complex logic to mirror DnD Beyond Character Sheet. Use the Foundry VTT API to interact with the game world and if not possible, pass through DnD Beyond Character interface actions to Foundry VTT.

Use modularity to break down the codebase into smaller, reusable components. 

Where applicable, bridge Foundry VTT API calls to DnD Beyond Character Sheet API calls.

Usability is a priority. 

Accessibility is a priority. 