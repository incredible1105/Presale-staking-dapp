import { useState } from "react";
import { useWeb3React, UnsupportedChainIdError } from "@web3-react/core";
import {
  InjectedConnector,
  NoEthereumProviderError,
  UserRejectedRequestError as UserRejectedRequestErrorInjected,
} from "@web3-react/injected-connector";
import {
  UserRejectedRequestError as UserRejectedRequestErrorWalletConnect,
  WalletConnectConnector,
} from "@web3-react/walletconnect-connector";
import { ethers } from "ethers";
import Web3 from "web3";

//0 ropsten, 1 bsc
let netid = 0;
let provider = null;
let walletconnect, injected, bsc;

//mainnet
// const netlist = [
//   {
//     chaind : 1,
//     rpcurl : "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
//     blockurl : "https://etherscan.io",
//     chainname : "Ethereum Mainnet",
//     chainnetname : "Ethereum Mainnet",
//     chainsymbol : "ETH",
//     chaindecimals : 18
//   },
//   {
//     chaind : 56,
//     rpcurl : "https://bsc-dataseed1.ninicoin.io",
//     blockurl : "https://bscscan.com/",
//     chainname : "Binance Smart Chain Mainnet",
//     chainnetname : "Binance Smart Chain Mainnet",
//     chainsymbol : "BNB",
//     chaindecimals : 18
//   },
// ]

//testnet
const netlist = [
  {
    chaind: 3,
    rpcurl: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    blockurl: "https://ropsten.etherscan.io",
    chainname: "Ethereum Mainnet",
    chainnetname: "Ethereum Mainnet",
    chainsymbol: "ETH",
    chaindecimals: 18,
  },
  {
    chaind: 97,
    rpcurl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    blockurl: "https://testnet.bscscan.com/",
    chainname: "BSC testnet",
    chainnetname: "BSC testnet",
    chainsymbol: "BNB",
    chaindecimals: 18,
  },
];

const defaultethereumconflag = {
  testing: false,
  autoGasMultiplier: 1.5,
  defaultConfirmations: 1,
  defaultGas: "6000000",
  defaultGasPrice: "1000000000000",
  nodetimeout: 10000,
};

function web3ProviderFrom(endpoint, config) {
  const ethConfig = Object.assign(defaultethereumconflag, config || {});

  const providerClass = endpoint.includes("wss")
    ? Web3.providers.WebsocketProvider
    : Web3.providers.HttpProvider;

  return new providerClass(endpoint, {
    timeout: ethConfig.nodetimeout,
  });
}

export function getDefaultProvider() {
  if (!provider) {
    provider = new ethers.providers.Web3Provider(
      web3ProviderFrom(netlist[netid].rpcurl),
      netlist[netid].chaind,
    );
  }

  return provider;
}

export function setNet(id) {
  netid = id;

  walletconnect = new WalletConnectConnector({
    rpc: { [netlist[netid].chaind]: netlist[netid].rpcurl },
    qrcode: true,
    pollingInterval: 12000,
  });

  injected = new InjectedConnector({
    supportedChainIds: [netlist[netid].chaind],
  });
}

export function useWalletConnector() {
  const { activate, deactivate } = useWeb3React();
  const [provider, setProvider] = useState({});

  const setupNetwork = async () => {
    const provider = window.ethereum; // Get the Ethereum provider from the window object
    if (provider) {
      try {
        // Attempt to switch to the desired network for MetaMask only
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [
            {
              chainId: `0x${netlist[netid].chaind.toString(16)}`, // Convert chain ID to hexadecimal format
            },
          ],
        });
        setProvider(provider); // Set the provider if the switch is successful
        return true; // Return true indicating success
      } catch (error) {
        // Handle errors that occur during the network switch
        if (error.code === 4902) { // Check if the error is due to an unrecognized chain ID
          try {
            // Attempt to add the network to MetaMask
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: `0x${netlist[netid].chaind.toString(16)}`, // Convert chain ID to hexadecimal format
                  chainName: netlist[netid].chainname, // Name of the chain
                  nativeCurrency: {
                    name: netlist[netid].chainsymbol, // Name of the native currency
                    symbol: netlist[netid].chainsymbol, // Symbol of the native currency
                    decimals: netlist[netid].chaindecimals, // Decimals for the native currency
                  },
                  rpcUrls: [netlist[netid].rpcurl], // RPC URL for the network
                  blockExplorerUrls: [netlist[netid].blockurl], // Block explorer URL for the network
                },
              ],
            });
            setProvider(provider); // Set the provider if the addition is successful
            return true; // Return true indicating success
          } catch (addError) {
            console.error(addError); // Log any errors that occur while adding the network
            return false; // Return false indicating failure
          }
        } else {
          console.error(error); // Log any other errors that occur during the switch
          return false; // Return false indicating failure
        }
      }
    } else {
      console.error(
        "Can't setup the network on MetaMask because window.ethereum is undefined"
      ); // Log an error if the provider is not available
      return false; // Return false indicating failure
    }
  };

  const loginMetamask = async () => {
    loginWallet(injected);
  };

  const loginWalletConnect = async () => {
    // Check if the selected network is supported by WalletConnect
    const isSupportedNetwork = netlist.some(net => net.chaind === netlist[netid].chaind);
    if (!isSupportedNetwork) {
      console.error("Selected network is not supported by WalletConnect.");
      return; // Handle unsupported network case
    }
    loginWallet(walletconnect); // Proceed to login with WalletConnect
  };

  const loginBSC = async () => {
    loginWallet(bsc);
  };

  const loginWallet = (connector) => {
    if (connector) {
      activate(connector, async (error) => {
        if (error instanceof UnsupportedChainIdError) {
          const hasSetup = await setupNetwork();
          if (hasSetup) {
            activate(connector);
          }
        } else {
          if (error instanceof NoEthereumProviderError) {
            console.log("Network Provide Error");
          } else if (
            error instanceof UserRejectedRequestErrorInjected ||
            error instanceof UserRejectedRequestErrorWalletConnect
          ) {
            console.log(
              "Authorization Error! Please authorize to access your account"
            );
          } else {
            console.log(error.name + error.message);
          }
        }
      });
    } else {
      console.log("Unable to find connector! The connector config is wrong");
    }
    setProvider(connector);
  };

  const logoutWalletConnector = () => {
    deactivate(provider, async (error) => {
      console.log(error);
      return false;
    });
    return true;
  };

  return {
    loginMetamask,
    loginWalletConnect,
    loginBSC,
    logoutWalletConnector,
  };
}
