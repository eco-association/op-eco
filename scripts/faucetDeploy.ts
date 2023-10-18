import { ethers } from 'hardhat'
import { Faucet } from '../typechain-types/contracts/token/Faucet'

async function main() {
  const ecoAddress = '0xe7bc9b3a936f122f08aac3b1fac3c3ec29a78874'
  const faucetFactory = await ethers.getContractFactory('Faucet')

  const faucet: Faucet = await faucetFactory.deploy(
    ecoAddress,
    0,
    0,
    '0xDD1834f5116c4E2DCE952220dE5641cc775FdaaD',
    ['0xDD1834f5116c4E2DCE952220dE5641cc775FdaaD']
  )

  console.log('Faucet deployed to:', faucet.address)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
