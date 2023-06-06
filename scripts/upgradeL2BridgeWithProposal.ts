import hre from 'hardhat'
import {
  L1_NETWORK,
  L2_NETWORK,
  l1BridgeProxyAddress,
} from './constants'

const l2gas = '0'

async function main() {
  // deploy new contract
  hre.changeNetwork(L2_NETWORK)

  const L2ECOBridgeFactory = await hre.ethers.getContractFactory('L2ECOBridge')
  const newL2ECOBridgeImpl = await L2ECOBridgeFactory.deploy()
  await newL2ECOBridgeImpl.deployed()
  console.log(`new L2 Bridge deployed to ${newL2ECOBridgeImpl.address}`)

  hre.changeNetwork(L1_NETWORK)

  const ProposalFactory = await hre.ethers.getContractFactory('TriggerL2BridgeUpgrade')
  const ProposalImpl = await ProposalFactory.deploy(l1BridgeProxyAddress, newL2ECOBridgeImpl.address, l2gas)
  await ProposalImpl.deployed()
  console.log(`Upgrade proposal deployed to ${ProposalImpl.address}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
