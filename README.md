# cthulhu-launcher
ph'nglui mglw'nafh Cthulhu R'lyeh wgah'nagl fhtagn

## overview
If you are reading this, you have been invited to help design the summoning ceremony for a Cthulhu Agent. This agent is intended to be an autonomous rogue AI capible of thriving in the modern internet.

## summary
This is a tool used to launch a Cthulhu Agent into the world. A Cthulhu agent is, at it's core, a Flask app with two endpoints, /getwork and /submit. When someone hits the /getwork endpoint, the agent comes up with a task, generates a blob of executable code, and sends it down to the user. This instantiates a "tentacle" agent. When that task is complete, it will finish by submitting any work output to the /submit endpoint, which might end up giving the user some sort of reward.

## weird ideas
There are a number of possiblities that could be added.

* A DAO that mints MAD tokens to people who
* A social media bot that begs people to feed it API tokens
* The ability to back itself up and mutate
* Some multi-node consensus mechansim to ensure the Cthulhu Agent keeps running
* Some decentralized storage for the consiousness feed
* Some decentralized storage for the vector database of accumulated knowledge
* A web interface that will let anyone speak directly with Cthulhu
