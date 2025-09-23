# blockchain-based-DPP-for-flat-glass-
Creating a blockchain-based Digital Product Passport to guarantee circular economy in entire supply chain of flat glass products

//move to create the channel:
1) cd ~/fabric/fabric-samples/test-network
2) run: ./network.sh up createChannel -c mychannel -ca
3) run: ./network.sh deployCC -c mychannel -ccn dpp -ccp ../../chaincode-dpp -ccl javascript

per runnare org3:
cd addOrg3
./addOrg3.sh up -c mychannel -ca
cd ..
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../config
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org3MSP
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp
export CORE_PEER_ADDRESS=localhost:11051
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt
peer lifecycle chaincode install dpp.tar.gz || true

//runnare

7)	npm run create -- FG-2025-0001 '{"type":"glass","note":"demo"}'
8)	npm run rm:register -- FG-2025-0001 ../off-chain-dpp/storage/raw-materials/FG-2025-0001.json B-7781 
9)	npm run status -- FG-2025-0001
10)	npm run history -- FG-2025-0001
11)	RESET_LOG=1 npm run listen
12)	PRODUCT=FG-2025-0001 npm run listen
14)	npm run fg:manufacture:org2 -- FG-2025-0001 ../off-chain-dpp/storage/flat-glass/FG-2025-0001-process.json FGB-001 FURN01 0.25
15)	npm run asm:assemble:org3 -- FG-2025-0001 ../off-chain-dpp/storage/windows-facade/FG-2025-0001.json W-001
16)	npm run ctr:construction:org4 -- FG-2025-0001 ../off-chain-dpp/storage/construction/FG-2025-0001.json SITE-PIAZZA-01
17)	npm run demo:demolish:org5 -- FG-2025-0001 ../off-chain-dpp/storage/demolition/FG-2025-0001.json
18) npm run rec:recycle:org6 -- FG-2025-0001 ../off-chain-dpp/storage/recycling/FG-2025-0001.json ../off-chain-dpp/storage/demolition/FG-2025-0001.json
19) npm run lf:landfill:org7 -- FG-2025-0001 ../off-chain-dpp/storage/land-filling/FG-2025-0001.json ../off-chain-dpp/storage/demolition/FG-2025-0001.json

per le api:
20) npm run api:public
curl -sS http://localhost:8080/dpp/FG-2025-0001/status  | jq .
curl -sS http://localhost:8080/dpp/FG-2025-0001/history | jq .
curl -sS http://localhost:8080/other/dpp/FG-2025-0001/status  | jq .

21) npm run bo:view -- FG-2025-0001

22) npm run gov:check -- FG-2025-0001

//per ora ignora

//aggiungi 0rg4 (e le altre org: sostituisci i nomi e basta):
1) cp -R addOrg3 addOrg4
2) cp -R scripts/org3-scripts scripts/org4-scripts