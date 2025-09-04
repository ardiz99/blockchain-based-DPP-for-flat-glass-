import grpc from '@grpc/grpc-js';
import { connect, hash, signers } from '@hyperledger/fabric-gateway';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==== Parametri base canale/chaincode ====
const channelName   = process.env.CHANNEL_NAME   || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'dpp';

// ==== Carica mappa identità ====
async function loadIdentities() {
  const p = path.resolve(__dirname, 'config', 'identities.json');
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw);
}

// ==== Utility: primo file in una dir (keystore) ====
async function firstFile(dir) {
  const files = await fs.readdir(dir);
  if (!files.length) throw new Error(`No files in ${dir}`);
  // preferisci .pem se presente
  const pem = files.find(f => f.endsWith('.pem')) || files[0];
  return path.join(dir, pem);
}

// ==== Costruisce i path di default per una MSP ====
function defaultsFor(mspId, user, orgDomain) {
  const root = path.resolve(
    __dirname,
    '../fabric-samples/test-network/organizations/peerOrganizations',
    orgDomain
  );

  return {
    mspId,
    cryptoPath: root,
    keyDir:  path.join(root, 'users', user, 'msp', 'keystore'),
    certDir: path.join(root, 'users', user, 'msp', 'signcerts'),
    tlsCert: path.join(root, 'peers', `peer0.${orgDomain}`, 'tls', 'ca.crt'),
  };
}

// ==== Costruisce la config finale (default + override ENV) ====
async function buildConfig() {
  const identities = await loadIdentities();

  const mspId = process.env.MSP_ID || 'Org1MSP';
  const entry = identities[mspId];
  if (!entry) {
    const known = Object.keys(identities).join(', ');
    throw new Error(`MSP_ID=${mspId} non trovato in identities.json (conosciuti: ${known})`);
  }

  const user = process.env.FABRIC_USER || entry.user; // es. User1@orgX...
  const defPaths = defaultsFor(mspId, user, entry.orgDomain);

  // override tramite ENV se presenti
  const cryptoPath = process.env.CRYPTO_PATH || defPaths.cryptoPath;
  const keyDir     = process.env.KEY_DIRECTORY_PATH  || defPaths.keyDir;
  const certDir    = process.env.CERT_DIRECTORY_PATH || defPaths.certDir;
  const tlsCert    = process.env.TLS_CERT_PATH       || defPaths.tlsCert;

  const peerEndpoint = process.env.PEER_ENDPOINT || entry.peerEndpoint;
  const peerHostAlias = process.env.PEER_HOST_ALIAS || entry.peerHostAlias;

  return {
    channelName,
    chaincodeName,
    mspId,
    cryptoPath,
    keyDir,
    certDir,
    tlsCert,
    peerEndpoint,
    peerHostAlias,
  };
}

// ==== gRPC, identity, signer ====
async function newGrpc(peerEndpoint, tlsCertPath, peerHostAlias) {
  const tlsRootCert = await fs.readFile(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(peerEndpoint, tlsCredentials, {
    'grpc.ssl_target_name_override': peerHostAlias,
  });
}

async function newIdentity(mspId, certDir) {
  const certPath = await firstFile(certDir);
  const credentials = await fs.readFile(certPath);
  return { mspId, credentials };
}

async function newSigner(keyDir) {
  const keyPath = await firstFile(keyDir);
  const privateKeyPem = await fs.readFile(keyPath);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

// ==== Export: connessione con Contract (invocazioni) ====
export async function newGatewayAndContract() {
  const cfg = await buildConfig();
  const client = await newGrpc(cfg.peerEndpoint, cfg.tlsCert, cfg.peerHostAlias);

  const gateway = connect({
    client,
    identity: await newIdentity(cfg.mspId, cfg.certDir),
    signer: await newSigner(cfg.keyDir),
    hash: hash.sha256,
    evaluateOptions:     () => ({ deadline: Date.now() + 5000 }),
    endorseOptions:      () => ({ deadline: Date.now() + 15000 }),
    submitOptions:       () => ({ deadline: Date.now() + 5000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });

  const network = gateway.getNetwork(cfg.channelName);
  const contract = network.getContract(cfg.chaincodeName);
  return { gateway, client, contract };
}

// ==== Export: connessione con Network (stream eventi) ====
export async function newGatewayAndNetwork() {
  const cfg = await buildConfig();
  const client = await newGrpc(cfg.peerEndpoint, cfg.tlsCert, cfg.peerHostAlias);

  const gateway = connect({
    client,
    identity: await newIdentity(cfg.mspId, cfg.certDir),
    signer: await newSigner(cfg.keyDir),
    hash: hash.sha256,
    evaluateOptions:     () => ({ deadline: Date.now() + 5000 }),
    endorseOptions:      () => ({ deadline: Date.now() + 15000 }),
    submitOptions:       () => ({ deadline: Date.now() + 5000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });

  const network = gateway.getNetwork(cfg.channelName);
  return { gateway, client, network };
}