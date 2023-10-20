import hre from 'hardhat'
import {
  L1_NETWORK,
  l1BridgeProxyAddress,
} from './constants'

async function main() {
  // deploy new contract
  hre.changeNetwork(L1_NETWORK)

  const L1ECOBridgeFactory = await hre.ethers.getContractFactory('L1ECOBridge')
  const newL1ECOBridgeImpl = await L1ECOBridgeFactory.deploy()
  await newL1ECOBridgeImpl.deployed()
  console.log(`new L1 Bridge deployed to ${newL1ECOBridgeImpl.address}`)

  const ProposalFactory = await hre.ethers.getContractFactory('TriggerL1BridgeUpgrade')
  const ProposalImpl = await ProposalFactory.deploy(l1BridgeProxyAddress, newL1ECOBridgeImpl.address)
  await ProposalImpl.deployed()
  console.log(`Upgrade proposal deployed to ${ProposalImpl.address}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
