import grpc from '@grpc/grpc-js';
import { connect, hash, signers } from '@hyperledger/fabric-gateway';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const channelName   = process.env.CHANNEL_NAME   || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'dpp';
const mspId         = process.env.MSP_ID         || 'Org1MSP';

const cryptoPath = process.env.CRYPTO_PATH || path.resolve(__dirname, '../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com');
const keyDir  = process.env.KEY_DIRECTORY_PATH  || path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore');
const certDir = process.env.CERT_DIRECTORY_PATH || path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts');
const tlsCert = process.env.TLS_CERT_PATH       || path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');
const peer    = process.env.PEER_ENDPOINT       || 'localhost:7051';
const host    = process.env.PEER_HOST_ALIAS     || 'peer0.org1.example.com';

export async function newGatewayAndContract() {
  const client = await newGrpc();
  const gateway = connect({
    client,
    identity: await newIdentity(),
    signer: await newSigner(),
    hash: hash.sha256,
    evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
    endorseOptions:  () => ({ deadline: Date.now() + 15000 }),
    submitOptions:   () => ({ deadline: Date.now() + 5000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });
  const network = gateway.getNetwork(channelName);
  const contract = network.getContract(chaincodeName);
  return { gateway, client, contract };
}

async function newGrpc() {
  const tlsRootCert = await fs.readFile(tlsCert);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(peer, tlsCredentials, { 'grpc.ssl_target_name_override': host });
}
async function firstFile(dir) {
  const files = await fs.readdir(dir);
  if (!files.length) throw new Error(`No files in ${dir}`);
  return path.join(dir, files[0]);
}
async function newIdentity() {
  const certPath = await firstFile(certDir);
  const credentials = await fs.readFile(certPath);
  return { mspId, credentials };
}
async function newSigner() {
  const keyPath = await firstFile(keyDir);
  const privateKeyPem = await fs.readFile(keyPath);
  return signers.newPrivateKeySigner(crypto.createPrivateKey(privateKeyPem));
}