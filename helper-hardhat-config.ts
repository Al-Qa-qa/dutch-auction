import { ethers, BigNumber } from "ethers";

type NetworkConfigItem = {
  name: string;
};

type NetworkConfigMap = {
  [chainId: string]: NetworkConfigItem;
};

export const networkConfig: NetworkConfigMap = {
  default: {
    name: "hardhat",
  },
  31337: {
    name: "localhost",
  },
  1: {
    name: "mainnet",
  },
  11155111: {
    name: "sepolia",
  },
  137: {
    name: "polygon",
  },
};

// Nft item used for testing constructor arguments
export const NFT_ITEM_NAME = "Test Collection";
export const NFT_ITEM_SYMBOL = "TC";
export const TOKEN_ID = BigNumber.from(0);

// Item that will be listed to the auction arguments
export const STARTING_PRICE = ethers.utils.parseEther("10"); // 10 ETH
export const DISCOUNT_RATE = ethers.utils
  .parseEther("1")
  .div(BigNumber.from(24 * 60 * 60)); // this means it will lose 1 ETH every day

export const developmentChains: string[] = ["hardhat", "localhost"];
export const VERIFICATION_BLOCK_CONFIRMATIONS = 6;
