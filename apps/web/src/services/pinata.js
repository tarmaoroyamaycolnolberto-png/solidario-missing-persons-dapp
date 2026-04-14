export async function uploadImageToPinata(file, jwt) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Error subiendo imagen a Pinata");
  }

  const data = await res.json();
  return data.IpfsHash;
}

export async function uploadJSONToPinata(jsonData, jwt) {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(jsonData),
  });

  if (!res.ok) {
    throw new Error("Error subiendo JSON a Pinata");
  }

  const data = await res.json();
  return data.IpfsHash;
}