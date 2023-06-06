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

  const L2ECOTokenFactory = await hre.ethers.getContractFactory('L2ECO')
  const newL2ECOTokenImpl = await L2ECOTokenFactory.deploy()
  await newL2ECOTokenImpl.deployed()
  console.log(`new L2 ECO deployed to ${newL2ECOTokenImpl.address}`)

  hre.changeNetwork(L1_NETWORK)

  const ProposalFactory = await hre.ethers.getContractFactory('TriggerL2ECOUpgrade')
  const ProposalImpl = await ProposalFactory.deploy(l1BridgeProxyAddress, newL2ECOTokenImpl.address, l2gas)
  await ProposalImpl.deployed()
  console.log(`Upgrade proposal deployed to ${ProposalImpl.address}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
