# blockchain-based-DPP-for-flat-glass-
Creating a blockchain-based Digital Product Passport to guarantee circular economy in entire supply chain of flat glass products

//move to create the channel:
1) cd ~/fabric/fabric-samples/test-network
2) run: ./network.sh up createChannel -c mychannel -ca
3) run: ./network.sh deployCC -c mychannel -ccn dpp -ccp ../../chaincode-dpp -ccl javascript

per runnare org3:
1) cd addOrg3
2) ./addOrg3.sh up -c mychannel -ca
3) cd ..
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../config
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org3MSP
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp
export CORE_PEER_ADDRESS=localhost:11051
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt
peer lifecycle chaincode install dpp.tar.gz || true


//runnare

4) npm run asm:assemble:org3 -- FG-2025-0001 ../off-chain-dpp/storage/windows-facade/FG-2025-0001.json WIN-001

//aggiungi 0rg4 (e le altre org: sostituisci i nomi e basta):
1) cp -R addOrg3 addOrg4
2) cp -R scripts/org3-scripts scripts/org4-scripts

Sostituisci:
cd ../addOrg4
grep -RIl 'Org3MSP' | xargs -I{} sed -i 's/Org3MSP/Org4MSP/g' {}
grep -RIl 'org3.example.com' | xargs -I{} sed -i 's/org3.example.com/org4.example.com/g' {}
grep -RIl '11051\|11054\|11055' | xargs -I{} sed -i -e 's/11051/12051/g' -e 's/11054/12054/g' -e 's/11055/12055/g' {}

Modifica: envVas.sh, setOrgEnv.sh e setAnchorPeer.sh aggiungendo Org4 

export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../config
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org4MSP
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org4.example.com/users/Admin@org4.example.com/msp
export CORE_PEER_ADDRESS=localhost:12051
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org4.example.com/peers/peer0.org4.example.com/tls/ca.crt
peer lifecycle chaincode install dpp.tar.gz || true
