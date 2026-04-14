import Web3 from "web3";
import { ACTIVE_NETWORK } from "./config";

let walletWeb3 = null;
let provider = null;
let currentWalletName = "";

function getInjectedProviders() {
  if (typeof window === "undefined") return [];

  const providers = [];

  if (window.ethereum?.providers && Array.isArray(window.ethereum.providers)) {
    providers.push(...window.ethereum.providers);
  } else if (window.ethereum) {
    providers.push(window.ethereum);
  }

  const uniqueProviders = [];
  const seen = new Set();

  for (const item of providers) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    uniqueProviders.push(item);
  }

  return uniqueProviders;
}

function getWalletName(p) {
  if (!p) return "Wallet desconocida";
  if (p.isBinance) return "Binance Wallet";
  if (p.isRabby) return "Rabby Wallet";
  if (p.isTrust || p.isTrustWallet) return "Trust Wallet";
  if (p.isCoinbaseWallet) return "Coinbase Wallet";
  if (p.isOKXWallet) return "OKX Wallet";
  if (p.isTokenPocket) return "TokenPocket";
  if (p.isBraveWallet) return "Brave Wallet";
  if (p.isMetaMask) return "MetaMask";
  return "Wallet EVM";
}

export function getAvailableWallets() {
  const providers = getInjectedProviders();

  return providers.map((p, index) => ({
    id: `${index}-${getWalletName(p)}`,
    name: getWalletName(p),
    provider: p,
  }));
}

function pickBestProvider() {
  const providers = getInjectedProviders();

  if (providers.length === 0) return null;
  if (providers.length === 1) return providers[0];

  const priorityChecks = [
    (p) => p.isBinance,
    (p) => p.isRabby,
    (p) => p.isTrust || p.isTrustWallet,
    (p) => p.isCoinbaseWallet,
    (p) => p.isOKXWallet,
    (p) => p.isTokenPocket,
    (p) => p.isBraveWallet,
    (p) => p.isMetaMask,
  ];

  for (const check of priorityChecks) {
    const found = providers.find(check);
    if (found) return found;
  }

  return providers[0];
}

export async function getProvider(selectedProvider = null) {
  if (selectedProvider) {
    provider = selectedProvider;
    currentWalletName = getWalletName(selectedProvider);
    return provider;
  }

  if (provider) return provider;

  const detectedProvider = pickBestProvider();

  if (detectedProvider) {
    provider = detectedProvider;
    currentWalletName = getWalletName(detectedProvider);
    return provider;
  }

  throw new Error("No se detectó una wallet EVM compatible");
}

export function getReadOnlyWeb3() {
  const rpcUrl =
    ACTIVE_NETWORK?.rpcUrls?.[0] || "https://bsc-dataseed.bnbchain.org";

  return new Web3(rpcUrl);
}

export async function switchToActiveNetwork(selectedProvider = null) {
  const p = await getProvider(selectedProvider);

  try {
    await p.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ACTIVE_NETWORK.chainId }],
    });
  } catch (error) {
    if (error?.code === 4902) {
      await p.request({
        method: "wallet_addEthereumChain",
        params: [ACTIVE_NETWORK],
      });
    } else {
      throw error;
    }
  }
}

export async function connectWallet(selectedProvider = null) {
  const p = await getProvider(selectedProvider);

  await switchToActiveNetwork(p);
  await p.request({ method: "eth_requestAccounts" });

  provider = p;
  currentWalletName = getWalletName(p);
  walletWeb3 = new Web3(p);

  const accounts = await walletWeb3.eth.getAccounts();
  const chainId = await p.request({ method: "eth_chainId" });

  if (chainId !== ACTIVE_NETWORK.chainId) {
    throw new Error("La wallet no está conectada a BNB Smart Chain");
  }

  return {
    web3: walletWeb3,
    provider: p,
    account: accounts?.[0] || "",
    chainId,
    walletName: currentWalletName,
  };
}

export async function promptWalletAccountSelection(selectedProvider = null) {
  const p = await getProvider(selectedProvider);

  await p.request({
    method: "wallet_requestPermissions",
    params: [{ eth_accounts: {} }],
  });

  return await connectWallet(p);
}

export async function getConnectedAccount(selectedProvider = null) {
  const p = await getProvider(selectedProvider);
  const accounts = await p.request({ method: "eth_accounts" });

  if (accounts?.[0]) {
    provider = p;
    currentWalletName = getWalletName(p);
    walletWeb3 = new Web3(p);
  }

  return accounts?.[0] || "";
}

export function getWalletWeb3() {
  if (walletWeb3) {
    return walletWeb3;
  }

  if (provider) {
    walletWeb3 = new Web3(provider);
    return walletWeb3;
  }

  throw new Error("Primero conecta tu wallet");
}

export function getCurrentProvider() {
  return provider;
}

export function getCurrentWalletName() {
  return currentWalletName;
}

export function disconnectWallet() {
  walletWeb3 = null;
  provider = null;
  currentWalletName = "";
}

export function resetWalletConnection() {
  disconnectWallet();
}

export function debugInjectedWallets() {
  const providers = getInjectedProviders();

  return providers.map((p, index) => ({
    index,
    name: getWalletName(p),
    isMetaMask: !!p.isMetaMask,
    isBinance: !!p.isBinance,
    isRabby: !!p.isRabby,
    isTrust: !!p.isTrust,
    isTrustWallet: !!p.isTrustWallet,
    isCoinbaseWallet: !!p.isCoinbaseWallet,
    isOKXWallet: !!p.isOKXWallet,
    isTokenPocket: !!p.isTokenPocket,
    isBraveWallet: !!p.isBraveWallet,
  }));
}