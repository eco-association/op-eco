import hre from 'hardhat'
import { ethers } from 'ethers'

export const randomAddress = () => {
  const bytes = hre.ethers.utils.randomBytes(20)
  const string = hre.ethers.utils.hexlify(bytes)
  return hre.ethers.utils.getAddress(string)
}

export const deploy = async (
  name: string,
  opts?: {
    args?: any[]
    signer?: any
  }
): Promise<ethers.Contract> => {
  const factory = await hre.ethers.getContractFactory(name, opts?.signer)
  return factory.deploy(...(opts?.args || []))
}

export const getContractInterface = async (
  contractName: string,
): Promise<ethers.utils.Interface> => {
  const artifact = await hre.artifacts.readArtifact(contractName);
  return new hre.ethers.utils.Interface(artifact.abi)
}