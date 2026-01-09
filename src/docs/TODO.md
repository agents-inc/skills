TODO

`NB`
[] create CLAUDE.md
[] handle existing patterns like storybook etc (can be hacky for now by moving to src)

`AGENTS GENERAL`

`STANDARDS_CATEGORISED`
[x] finish adding existing examples
[x] trim examples of any redundancy or verbosity
[x] add proper cross-referencing if this is useful for agents
[x] icons should use icon lib
[x] add newer examples generated already by ai
[x] update (find out how best to) agents based on these standards
[x] update skills from react agent extraction
[x] remove mobx
[x] rename agents
[] find examples for other sub sections too. there is still a lot outstanding
[] critique these examples and add more for each
[] these links wont work at all because they get bundled in the same files

`CONTEXT MANAGEMENT`
[x] find out how to ignore folders from claude. test this

`TESTS`
[] see if using loading skills dynamically or at build is better
[] agent context cutoff before they become more retarded

`AGENT GENERATION AGENT`
[] create one

`NORTHSTAR - TEMPLATE`
[] create design system
[] use agents to build out any side project maintaining standards

`DOCS`
[x] create comprehensive documentation for the frontend standards that can be used as imput for later agents/hooks
[] get claude to say if bible is correct sum of 2 other docs in project knowledge. if so, delete others

`NEXT`
[] try spec-kit and its output
[] try cursor 2

`REPO`
[] make source of truth
[] try cli tool to make using easier

`SKILLS 2.0`
[] new agents

`PATTERN EXTRACT AGENT`
[] create own categories and share between `EXTRACTOR` and `CRITIQUE`
[] extract each section into own file, with index file for overview

`PATTERN CRITIQUE AGENT`
[] create critique files alongside extracted standards
[] create index file that lists every single section and use that for referencing. then when updates are made, just need to update index
[] extend agent to also critique other agents
[] test only focusing on ONE certain section, like design system of cv-launch or monorepo arch of monorepo-playground
[] test back-and-forth to get to ideal
[] create agent that takes all the knowledge we have and knows how to create the best agents possible by pointing to the right standards
-- you should be able to include new standards into this agent too (like feature slices if none existed)
[] use agent to create ideal defaults, then use side projects or online to populate each category with example implementations
