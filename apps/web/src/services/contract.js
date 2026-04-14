import ABI from "../abi/MissingPersonsABI.json";
import { CONTRACT_ADDRESS } from "../config";
import { getReadOnlyWeb3, getWalletWeb3 } from "../web3";

export function getReadContract() {
  const web3 = getReadOnlyWeb3();
  return new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
}

export function getWriteContract() {
  const web3 = getWalletWeb3();
  return new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
}

export async function createCaseOnChain(recipient, metadataCID, account) {
  if (!account) {
    throw new Error("Primero conecta tu wallet");
  }

  const contract = getWriteContract();

  return contract.methods.createCase(recipient, metadataCID).send({
    from: account,
  });
}

export async function getCaseById(caseId) {
  const contract = getReadContract();
  const data = await contract.methods.getCase(caseId).call();

  return {
    id: Number(data.id ?? data[0] ?? 0),
    recipient: data.recipient ?? data[1] ?? "",
    metadataCID: data.metadataCID ?? data[2] ?? "",
    status: Number(data.status ?? data[3] ?? 0),
    totalDonated: data.totalDonated ?? data[4] ?? "0",
    creator: data.creator ?? data[5] ?? "",
    active: Boolean(data.active ?? data[6] ?? false),
  };
}

export async function getNextCaseId() {
  const contract = getReadContract();
  const value = await contract.methods.nextCaseId().call();
  return Number(value);
}

export async function getCasesCount() {
  const contract = getReadContract();
  const value = await contract.methods.getCasesCount().call();
  return Number(value);
}

export async function caseExistsById(caseId) {
  const contract = getReadContract();
  return await contract.methods.caseExistsById(caseId).call();
}

export async function getCasesCreatedByAccount(account) {
  if (!account) return [];

  const total = await getCasesCount();
  const results = [];

  for (let i = 0; i < total; i += 1) {
    try {
      const item = await getCaseById(i);

      if (
        item?.creator &&
        String(item.creator).toLowerCase() === String(account).toLowerCase()
      ) {
        results.push(item);
      }
    } catch (error) {
      console.error(`Error leyendo caso ${i}:`, error);
    }
  }

  return results.sort((a, b) => Number(b.id) - Number(a.id));
}

export async function updateCaseStatusOnChain(caseId, status, account) {
  if (!account) {
    throw new Error("Primero conecta tu wallet");
  }

  const normalizedStatus = Number(status);

  if (![0, 1].includes(normalizedStatus)) {
    throw new Error("Estado inválido");
  }

  const contract = getWriteContract();

  return contract.methods.updateStatus(caseId, normalizedStatus).send({
    from: account,
  });
}

export async function donateToCase(caseId, amountInBNB, account) {
  if (!account) {
    throw new Error("Primero conecta tu wallet");
  }

  const contract = getWriteContract();
  const web3 = getWalletWeb3();

  const value = web3.utils.toWei(String(amountInBNB), "ether");

  return contract.methods.donate(caseId).send({
    from: account,
    value,
  });
}

export function formatWeiToBNB(value) {
  const web3 = getReadOnlyWeb3();
  return web3.utils.fromWei(String(value || "0"), "ether");
}

export async function getPastContractEvents(eventName, options = {}) {
  const contract = getReadContract();

  try {
    const events = await contract.getPastEvents(eventName, {
      fromBlock: options.fromBlock ?? 0,
      toBlock: options.toBlock ?? "latest",
      filter: options.filter ?? {},
    });

    return Array.isArray(events) ? events : [];
  } catch (error) {
    console.error(`Error obteniendo eventos ${eventName}:`, error);
    return [];
  }
}

export async function getUserActivityFromEvents(account, caseIds = []) {
  if (!account) return [];

  const normalizedAccount = String(account).toLowerCase();
  const normalizedCaseIds = new Set(caseIds.map((id) => String(id)));

  const [caseCreatedEvents, donationEvents, statusEvents] = await Promise.all([
    getPastContractEvents("CaseCreated"),
    getPastContractEvents("DonationReceived"),
    getPastContractEvents("StatusUpdated"),
  ]);

  const activity = [];

  for (const event of caseCreatedEvents) {
    const creator = String(
      event?.returnValues?.creator ?? event?.returnValues?.[1] ?? ""
    ).toLowerCase();

    if (creator !== normalizedAccount) continue;

    const caseId = String(event?.returnValues?.id ?? event?.returnValues?.[0] ?? "");
    const blockNumber = event?.blockNumber ?? "";

    activity.push({
      id: `chain-created-${caseId}-${event?.transactionHash || blockNumber}`,
      type: "Caso creado",
      detail: `Se creó el caso #${caseId}`,
      source: "blockchain",
      txHash: event?.transactionHash || "",
      blockNumber,
      timestamp: null,
      timestampLabel: `Bloque ${blockNumber || "—"}`,
    });
  }

  for (const event of donationEvents) {
    const caseId = String(event?.returnValues?.id ?? event?.returnValues?.[0] ?? "");

    if (!normalizedCaseIds.has(caseId)) continue;

    const amountWei = event?.returnValues?.amount ?? event?.returnValues?.[2] ?? "0";
    const donor = event?.returnValues?.donor ?? event?.returnValues?.[1] ?? "";
    const amountBNB = formatWeiToBNB(amountWei);
    const blockNumber = event?.blockNumber ?? "";

    activity.push({
      id: `chain-donation-${caseId}-${event?.transactionHash || blockNumber}`,
      type: "Donación recibida",
      detail: `Caso #${caseId} recibió ${amountBNB} BNB de ${String(donor).slice(0, 8)}...${String(donor).slice(-6)}`,
      source: "blockchain",
      txHash: event?.transactionHash || "",
      blockNumber,
      timestamp: null,
      timestampLabel: `Bloque ${blockNumber || "—"}`,
    });
  }

  for (const event of statusEvents) {
    const caseId = String(event?.returnValues?.id ?? event?.returnValues?.[0] ?? "");

    if (!normalizedCaseIds.has(caseId)) continue;

    const newStatus = Number(
      event?.returnValues?.newStatus ?? event?.returnValues?.[1] ?? 0
    );
    const blockNumber = event?.blockNumber ?? "";

    activity.push({
      id: `chain-status-${caseId}-${event?.transactionHash || blockNumber}`,
      type: "Estado actualizado",
      detail: `Caso #${caseId} marcado como ${
        newStatus === 1 ? "Encontrado" : "Desaparecido"
      }`,
      source: "blockchain",
      txHash: event?.transactionHash || "",
      blockNumber,
      timestamp: null,
      timestampLabel: `Bloque ${blockNumber || "—"}`,
    });
  }

  return activity;
}