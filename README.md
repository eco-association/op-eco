# op-eco
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
> The optimism implementation of the ECO contract, bridge contracts and associated tooling

The Optimism version of ECO and the corresponding bridges to and from Ethereum are implemented here, along with all the tools, frameworks and tests used. 

The project is organized into components:
 - [The bridge implementation](contracts/bridge)
 - [The interfaces used](contracts/interfaces/bridge)
 - [Template upgrade proposals](contracts/temp_proposals)
 - [The token implementation](contracts/VDF)
 - [The deployment tooling](contracts/deploy)

## Table of Contents
 - [Security](#security)
 - [Background](#background)
 - [Install](#install)
 - [Usage](#usage)
 - [Components](#components)
 - [Contributing](#contributing)
 - [License](#license)

## Security
### Note on Solidity Optimizations
This repository has non-default compiler optimizations turned on! This can, in some cases, result in unexpected behavior. The test suites are designed to be run with optimizations configured as they are for deployment and will not detect changes in behavior caused by the optimizer.

If you believe the optimizer may be changing the behavior of your code please test with the optimizer disabled to verify and discuss with the team.

### Reporting Vulnerabilities
If you believe you've identified a security vulnerability in the Eco Currency contracts or other software, please submit to the Immunefi bounty (link coming soon) or join the Eco Association Discord (https://discord.eco.org) and tag or message an Eco Association team member.

## Background
The currency deployed here is the Optimism version of ECO, the mainnet implementation and associated governance can be found [here](https://github.com/helix-foundation/currency). The bridges can be used to move value between the Ethereum mainnet system and the Optimism one. 

### OP-ECO vs Mainnet ECO
OP-ECO as it stands today only retains the ECO contract from mainnet, as its primary purpose is to give users the ability to transfer ECO cheaply and efficiently. OP-ECO does not have its own community governance - an abbreviated set of upgrades can be made by using the Mainnet governance system and then propagating those changes via the bridge. OP-ECO's monetary policy has been pared down to reflect only one of Mainnet ECO's three levers - linear inflation. Inflation rate changes must also originate from Mainnet and be propagated to OP-ECO via the bridge. 

#### Tokens (/currency)
##### The Base Currency
ECO is a variable supply base currency. The token (ECO) implementation provides the code driving the ERC20 token. It takes responsibility for storing balances for all account holders, transferring funds between accounts, creating and destroying tokens, and providing the interfaces that token holders will typically interact with.

##### The Secondary Token
The secondary token (ECOx) is a deflationary supply asset intended to incentivize long-term holders and bootstrap governance and an open market signaling expectations for ECO adoption. It is also an ERC20 token. Its initial main functionality, aside from governance, is being convertible to an amount of ECO proportionally based on percentage of the total supply of each token.

#### The Governance System (/governance)
The Governance module contains the monetary and community governance submodules, as well as the general governance logic for pushing the ECOsystem into a new generation. Monetary and community governance operate on a timescale defined by this logic.

##### Monetary Governance (/governance/monetary)
The monetary governance submodule allows community-elected trustees to make decisions about the monetary supply in the economy. It initially involves 3 possible actions: minting tokens and distributing them at random (Random Inflation), minting tokens and using them as rewards for lockup contracts (Lockups), and re-scaling each account balance equally (Linear Inflation).


##### Community Governance (/governance/community)
The community governance submodule allows anyone with tokens (ECO or ECOx) to propose arbitrary changes to contracts and then participate in a vote on those changes, all  facilitated to by the policy framework. This allows for the ECOsystem to adapt to changing economic circumstances and evolve to meet users' needs and giving users direct influence over the economy in which they all participate.

### Infrastructure
Outside of these core modules there are a few major infrastructure components that underlie the system, but whose use is primarily abstracted away from the user:

#### The Policies Framework (/policy)
The policies framework provides the core contract logic that facilitates upgradability, and is used to enforce access control and permissions between contracts. This framework also uses the clone component (/clone) to efficiently deploy clones of core contracts on generation increase.

#### The Proxy Framework (/proxy)
The proxy framework, combined with the ERC1820 registry, allow contracts to be upgraded while keeping their state intact and maintaining accessibility without the need to publicize a new address.

#### The VDF Implementation (/VDF)
Eco uses a VDF as a critical component of the the Random Inflation process (part  of the monetary governance module), and the VDF component provides most of that functionality. It allows incremental proving of a Verifiable Delay Function, and the demonstration of a proof to the governance system.

#### The Deployment Tooling (/deploy)
The deployment tooling is used to bootstrap the other contracts when first deployed to an Ethereum network. It includes the functionality necessary to configure the system, and also provides faucet and cleanup contracts for use in testing.

## Install
To use the code you'll need the proper tools. Make sure you have a recent version of [Node.JS](https://nodejs.org), and a recent version of [NPM](https://npmjs.com).

Once Node and NPM are installed you can use the `npm` command to install additional dependencies:
```
npm ci
```

## Usage
These contracts are intended for deployment to the Ethereum and Optimism chains (L1EcoBridge to Eth mainnet and the rest to OP). Once deployed, you can interact with the contracts using the standard Ethereum RPC mechanisms.

### Running the Linter, Tests and Coverage Report
The commands below provide the basics to get set up developing as well as outlining conventions and standards - all code should pass the linter and prettier, all tests should pass, and code coverage should not decrease.

#### Linting + prettier
`eslint` and `solhint` are used to lint the code in this repository. Additionally, the prettier enforces a clean code style for readability. You can run the linter and prettier using:
```
npm run lint
```
and
```
npm run format
``` 
respectively. 

#### Testing
You can run the test suite by invoking:
```
npm run test
```

The test suite is extensive and can take some time to run.

#### Coverage Reporting
Coverage reports are generated separated for Solidity and JavaScript code:
```
npm run coverage:js
npm run coverage:sol
```

Or, aliased for convenience when running both:
```
npm run coverage
```

### Running a deployment
Once the repo is cloned and all the libraries are installed, the project can be deployed by running `npm run deploy [path_to_config_file]` from the root directory. Running this deploy command recompiles all contracts and then attempts to deploy them via the deployment script found at `tools/eco.js`. The provided configurations differ by chain, deployed modules, and time windows for governance phases.

`tools/deployConfigs/deployConfigTokensAndGovernanceHelix` serves as a good starting point for any custom configurations, just set the correct webrpc and private key, and input your own initial addresses and trusted nodes.

Common deploy issues and solutions (use verbose flag):
- if the token deploy fails while distributing initial ECOx, you will have to try to redeploy from a different private key. Failure before this point can be remedied by simply running the deploy again, and completion of this step means that the currency was fully deployed.
- if your config is set to deploy both the currency and governance modules and the deployment fails during the governance module you will need to deploy the governance again without the currency. Make a new config based on one of the provided governance-only configs, turn off the deployCurrency flag,  and copy/paste the terminal output from the successful currency deployment at the bottom of the json.
- if experiencing errors indicating that the gas limit is too low, try slightly increasing the bootstrapGas value (in tools/deploy) and/or the gasMultiplier (in the config or tools/deploy). 
- tracking the deploy address on a block explorer may provide more useful error info, but in the event that the deploy still fails, try again from a private key. 

## Components
 - [Currency Implementation](./contracts/currency)
 - [Governance](./contracts/governance)
    - [Community governance](./contracts/governance/community)
    - [Monetary governance](./contracts/governance/monetary)
 - [Policy Framework](./contracts/policy)
 - [Proxy Framework](./contracts/proxy)
 - [Deployment Tools](./contracts/deploy)
 - [The Verifiable Delay Function](./contracts/VDF)

## Contributing
Contributions are welcome. Please submit any issues as issues on GitHub, and open a pull request with any contributions.

Please ensure that the test suite passes (run `npm test`) and that the linters run at least as cleanly as they did when you started (run `npm run lint`). Pull requests that do not pass the test suite or that produce significant lint errors will likely not be accepted.

See the [contributing guide](./CONTRIBUTING.md) for more details.

## License
[MIT (c) Helix Foundation](./LICENSE)
