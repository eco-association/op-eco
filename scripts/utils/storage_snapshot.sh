#!/usr/bin/env bash

set -e
#from https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/scripts/storage-snapshot.sh
if ! command -v forge &> /dev/null
then
    echo "forge could not be found. Please install forge by running:"
    echo "curl -L https://foundry.paradigm.xyz | bash"
    exit
fi

contracts=(
  contracts/bridge/CrossDomainEnabledUpgradeable.sol:CrossDomainEnabledUpgradeable
  contracts/bridge/InitialBridge.sol:InitialBridge
  contracts/bridge/L1ECOBridge.sol:L1ECOBridge
  contracts/bridge/L2ECOBridge.sol:L2ECOBridge
  contracts/token/ERC20Upgradeable.sol:ERC20Upgradeable
  contracts/token/L2ECO.sol:L2ECO
  contracts/token/TokenInitial.sol:TokenInitial
)

dir=$(dirname "$0")
outFile=$dir/../../.storage-layout

echo "Creating storage layout diagrams.."

echo "=======================" > $outFile
echo "👁👁 STORAGE LAYOUT snapshot 👁👁" >> $outFile
echo "=======================" >> $outFile

for contract in ${contracts[@]}
do
  echo -e "\n=======================" >> $outFile
  echo "➡ $contract">> $outFile
  echo -e "=======================\n" >> $outFile
  forge inspect --pretty $contract storage-layout >> $outFile
done
echo "Storage layout snapshot stored at $outFile"