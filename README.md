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

OP-ECO as it stands today only retains the ECO contract from mainnet, as its primary purpose is to give users the ability to transfer ECO cheaply and efficiently. OP-ECO does not have its own community governance - an abbreviated set of upgrades can be made by using the Mainnet governance system and then propagating those changes via the bridge. OP-ECO's monetary policy has been pared down to only one lever, linear inflation, and that rate is pegged to the rate set on the mainnet implementation by elected trustees. Inflation rate changes made on mainnet propagate to OP-ECO via the bridge.

## API

### L1ECOBridge
This bridge contract lives on the L1 and serves as the entrypoint for ECO destined for L2 as well as changes to L2 contracts. It implements Optimism's [IL1ERC20Bridge](https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts/contracts/L1/messaging/IL1ERC20Bridge.sol) along with a few other methods specific to how ECO operates. 

#### Events
##### UpgradeL2ECO
Arguments:
- `_newEcoImpl` (address) - the new implementation of the L2 Eco contract

Emitted when initiating an upgrade to the L2 Eco contract.

##### UpgradeL2Bridge
Arguments:
- `_newBridgeImpl` (address) - the new implementation of the L2 side of the ECO bridge

Emitted when initiating an upgrade to the L2 bridge contract.

##### UpgradeSelf
Arguments:
- `_newBridgeImpl` (address) - the new implementation of the L1 side of the ECO bridge

Emitted when the L1 Eco Bridge contract is upgraded and now points to a different implementation.

##### WithdrawalFailed
Arguments:
- `l1Token` (address) - address of the L1 token being withdrawn (should always be the L1 ECO address)
- `l2Token` (address) - address of the L2 token being exchanged (should always be the L2 ECO address)
- `_from` (address) - address depositing the L2 token to be exchanged
- `__to_` (address) - address attempting to withdraw the L1 token
- `_amount` (uint256) - amount of L1 token attempting to be withdrawn
- `_data` (bytes) - other transaction data

Emitted when a withdraw call fails.

#### initialize
Arguments: 
- `_l1messenger` (address) - address of the L1 portion of the cross-domain messenger
- `_l2TokenBridge` (address) - address of the L2 side of the bridge
- `_l1Eco` (address) - address of the L1 ECO currency
- `_l2Eco` (address) - address of the L2 ECO currency
- `_l1ProxyAdmin` (address) - address of the proxy admin for this contract
- `_upgrader` (address) - address with permission to call this contract's upgrade methods

This method sets all the initial values for the contract's state variables.

##### Security notes
This method can only be called once, as it is subject to the 'initializer' modifier.

#### upgradeEco
Arguments:
- `_impl` (address) - the new implementation for ECO on L2
- `_l2Gas` (uint32) - amount of gas required for tx completion on L2

This method is used to upgrade the implementation of the L2 ECO currency. Storage variables will not change as they are stored on the proxy. It also emits UpgradeL2ECO(_impl).

##### Security notes
This method can only be called by the upgrader address.

#### upgradeL2Bridge
Arguments:
- `_impl` (address) - the new implementation for the L2 part of the bridge
- `_l2Gas` (uint32) - amount of gas required for tx completion on L2

This method is used to upgrade the implementation of the L2 part of the bridge. It also emits UpgradeL2Bridge(_impl).

##### Security notes
This method can only be called by the upgrader address.

#### upgradeSelf
Arguments:
- `_impl` (address) - the new implementation for the L1 part of the bridge

This method is used to upgrade the implementation of the L1 part of the bridge. It also emits UpgradeSelf(_impl).

##### Security notes
This method can only be called by the upgrader address.

#### depositERC20
Arguments:
- `_l1Token` (address) - address of the token being deposited on L1
- `_l2Token` (address) - address of the token being minted on L2 in exchange for deposit
- `_amount` (uint256) - amount of tokens being deposited
- `_l2Gas` (uint32) - amount of gas required for tx completion on L2
- `_data` (bytes) - other transaction data

This method is used to deposit ECO in order to mint a corresponding amount of L2 ECO to the sender's address. 

##### Security notes
This method demands that _l1Token be the address of the L1 ECO token and _l2Token be the address of the L2 ECO token. Failing to comply with either of these will result in the call being reverted. All validity restrictions for transfers are also enforced.

#### depositERC20To
Arguments:
- `_l1Token` (address) - address of the token being deposited on L1
- `_l2Token` (address) - address of the token being minted on L2 in exchange for deposit
- `_to` (address) - destination address for L2 tokens
- `_amount` (uint256) - amount of tokens being deposited
- `_l2Gas` (uint32) - amount of gas required for tx completion on L2
- `_data` (bytes) - other transaction data

This method is used to deposit ECO in order to mint a corresponding amount of L2 ECO to the _to address. 

##### Security notes
This method demands that _l1Token be the address of the L1 ECO token and _l2Token be the address of the L2 ECO token. Failing to comply with either of these wil result in the call being reverted. All validity restrictions for transfers are also enforced.

#### finalizeERC20Withdrawal
Arguments:
- `_l1Token` (address) - address of the L1 token being withdrawn
- `_l2Token` (address) - address of the token being deposited on L2 in exchange for the L1 token
- `_from` (address) - depositor address on L2
- `_to` (address) - destination address on L1
- `_gonsAmount` (uint256) - amount of tokens to be withdrawn on L1, not yet subjected to inflation multiplier
- `_data` (bytes) - other transaction data

This method finalizes a withdrawal transaction initiated by the _from address on L2 and transfers the commensurate amount of ECO to the _to address.

##### Security notes
This method can only be called by the cross-domain messenger. While there is no modifier forcing the _l1Token and _l2Tokens address to be those of ECO, the cross-domain messenger will only ever call them with the correct arguments. 

#### rebase
Arguments:
- `_l2Gas` (uint32) - amount of gas required for tx completion on L2

This method transmits the current inflation multiplier to the L2 portion of the ECO system.

##### Security notes
This method cannot be maliciously called since it looks up the correct inflation multiplier before sending it.

### L2ECOBridge
This bridge contract lives on the L2 and serves as the L2 ECO system's source for all information on changes on L1, and the gateway for all tokens incoming from L1. It implements Optimism's [IL2ERC20Bridge](https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts/contracts/L2/messaging/IL2ERC20Bridge.sol) along with a few other methods specific to how ECO operates. 

#### Events
##### RebaseInitiated
Arguments:
- `_inflationMultiplier` (uint256) - new inflation multiplier

Emitted when rebase is called and the inflation multiplier is updated to _inflationMultiplier

##### UpgradeECOImplementation
Arguments:
- `_newEcoImpl` (address) - the new implementation of the L2 Eco contract

Emitted when the L2 Eco contract is upgraded and now points to a different implementation.

##### UpgradeSelf
Arguments:
- `_newBridgeImpl` (address) - the new implementation of the L2 side of the ECO bridge

Emitted when the L2 Eco Bridge contract is upgraded and now points to a different implementation.

#### initialize
Arguments: 
- `_l2CrossDomainMessenger` (address) - address of the L2 portion of the cross-domain messenger
- `_l1TokenBridge` (address) - address of the L1 side of the bridge
- `_l1Eco` (address) - address of the L1 ECO currency
- `_l2Eco` (address) - address of the L2 ECO currency
- `_l1ProxyAdmin` (address) - address of the proxy admin for this contract

This method sets all the initial values for the contract's state variables.

##### Security notes
This method can only be called once, as it is subject to the 'initializer' modifier.

#### withdraw
Arguments:
- `_l2Token` (address) - address of the token being deposited
- `_amount` (uint256) - amount of tokens being deposited
- `_l1Gas` (uint32) - amount of gas required for tx completion on L1
- `_data` (bytes) - other transaction data

This method is used to deposit L2 ECO in order to release a corresponding amount of L2 ECO to the sender's address. 

##### Security notes
This method demands that _l2Token be the address of the L2 ECO token. Failing to comply with either of these will result in the call being reverted. All validity restrictions for transfers are also enforced.

#### withdrawTo
Arguments:
- `_l2Token` (address) - address of the token being deposited
- `_to` (address) - destination address for L1 tokens
- `_amount` (uint256) - amount of tokens being deposited
- `_l1Gas` (uint32) - amount of gas required for tx completion on L1
- `_data` (bytes) - other transaction data

This method is used to deposit L2 ECO in order to release a corresponding amount of L2 ECO to the _to address. 

##### Security notes
This method demands that _l2Token be the address of the L2 ECO token. Failing to comply with either of these will result in the call being reverted. All validity restrictions for transfers are also enforced.

#### finalizeDeposit
Arguments:
- `_l1Token` (address) - address of the L1 token being deposited
- `_l2Token` (address) - address of the L2 token being minted on L2 in exchange for the L1 token
- `_from` (address) - depositor address on L1
- `_to` (address) - destination address on L2
- `_amount` (uint256) - amount of tokens to be minted on L2, not yet subjected to inflation multiplier
- `_data` (bytes) - other transaction data

This method finalizes a deposit transaction initiated by the _from address on L1 and transfers the commensurate amount of L2 ECO to the _to address.

##### Security notes
This method can only be called by the cross-domain messenger. This method also demands that the _l1Token and _l2Token arguments correspond to the L1 and L2 implementations of ECO respectively, reverting if either of these conditions is not met. 

#### rebase
Arguments:
- `_inflationMultiplier` (uint256) - new inflation multiplier to be used

This method accepts the new inflation multiplier and updates the L2 values. It also emits RebaseInitiated(_inflationMultiplier)

##### Security notes
This method can only be called by the cross-domain messenger. Additionally, this method will revert in the unlikely event that the _inflationMultiplier argument is invalid. 

#### upgradeECO
Arguments:
- `_newEcoImpl` (address) - the new implementation for ECO on L2

This method upgrades the implementation of the L2 ECO currency. Storage variables will not change as they are stored on the proxy. It also emits UpgradeECOImplementation(_newEcoimpl).

##### Security notes
This method can only be called by the cross-domain messenger.

#### upgradeSelf
Arguments:
- `_newBridgeImpl` (address) - the new implementation for the L2 part of the bridge

This method is used to upgrade the implementation of the L2 part of the bridge. It also emits UpgradeSelf(_newBridgeImpl).\

### L2ECO
This contract implements ECO on L2. It allows for rebasing functionality, with a linear inflation multiplier that changes according to governance executed on L1 and propagated to L2 via the bridge.

#### Events
##### BaseValueTransfer
Arguments:
- `from` (address) - origin address
- `to` (address) - destination address
- `value` (uint256) - amount of tokens being transferred, has not yet been subjected to inflation multiplier

Emitted in the _beforeTokenTransfer hook. Uninflated value is used for consistency

##### Mint
Arguments:
- `_account` (address) - recipient address of minted tokens
- `_amount` (uint256) - amount of tokens minted

Emitted upon the minting of L2 ECO.

##### Burn
Arguments:
- `_account` (address) - address whose tokens were burned
- `_amount` (uint256) - amount of tokens burned

Emitted upon the burning of L2 ECO.

##### NewInflationMultiplier
Arguments:
- `inflationMultiplier` (uint256) - the new inflation multiplier

Emitted upon rebase of L2 ECO.

#### initialize
Arguments:
- `_l1Token` (address) - address of L1 ECO
- `_l2Bridge` (address) - adddress of L2 bridge

This method sets all the initial values for the contract's state variables.

##### Security notes
This method can only be called once, as it is subject to the 'initializer' modifier.

#### balanceOf

#### totalSupply

#### updateMinters

#### updateBurners

#### updateRebasers

#### updateTokenRoleAdmin

#### mint

#### burn

#### rebase

#### supportsInterface

##### Security notes
This method can only be called by the cross-domain messenger.

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
