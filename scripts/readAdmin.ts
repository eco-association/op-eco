import hre from 'hardhat'
import Web3 from 'web3'

let web3 = new Web3(hre.network.config.url)

const address = '0x4dD376F2C7BdC8b22d9518B30FFad6B42FAa511f'
// const address = '0xb8637f39ada7Ffd529B208bE50DC1898211698eB'
// const address = '0xe7BC9b3A936F122f08AAC3b1fac3C3eC29A78874'
const adminStorageSlot = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103'

async function main() {
    const admin = await web3.eth.getStorageAt(address, adminStorageSlot)
  
    console.log(`value is : ${admin}`)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})