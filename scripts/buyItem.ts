import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { DutchAuction, NftItem } from "../typechain-types";
import { DISCOUNT_RATE, STARTING_PRICE, TOKEN_ID } from "../helper-hardhat-config";

async function buyItem() {
  const [seller, buyer] = await ethers.getSigners();
  const networkName: string = network.name;
  const contracts = Object(jsonContracts);
  if (!contracts[networkName].DutchAuction) {
    throw new Error("Contract is not deployed yet");
  }
  if (networkName === "hardhat") {
    throw new Error("Can't run scripts to hardhat network deployed contract");
  }
  const dutchAuction: DutchAuction = await ethers.getContractAt(
    "DutchAuction",
    contracts[networkName].DutchAuction,
    seller
  );

  const nftItem: NftItem = await ethers.getContractAt(
    "NftItem",
    contracts[networkName].NftItem,
    seller
  );

  try {
    // Creating auction of the item
    await dutchAuction.connect(buyer).buyItem(nftItem.address, TOKEN_ID, { value: STARTING_PRICE });
    console.log("Item bought successfully");
    const owner = await nftItem.ownerOf(0);
    console.log("New nft owner: " + owner);
  } catch (err) {
    console.log(err);
    throw new Error("Failed to buy item");
  }

  return dutchAuction;
}

buyItem()
  .then((dutchAuction) => {
    console.log("Bought process occuars successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
