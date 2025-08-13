import React, { useState, useRef, useEffect } from "react";
import {
  ChakraProvider,
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,

  Flex,
  Spinner,
  Select,
} from "@chakra-ui/react";

import { customTheme } from "./theme";

import { ethers } from "ethers";
import { Client, Utils } from "@xmtp/browser-sdk";
// Removed WalletConnect provider import

function App() {
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);


  const chatContainerRef = useRef(null);
  const identityFileInputRef = useRef(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [isCthulhuThinking, setIsCthulhuThinking] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [xmtpConversation, setXmtpConversation] = useState(null);
  const streamTaskRef = useRef(null);
  const seenMessageIdsRef = useRef(new Set());
  // self inbox id is captured per-connection via knownInboxId; no state needed

  const DEFAULT_PEER = "0x09d2e0b59E7Aee57f0cECaa7dbF5ff996e5A5dB1";
  const [peerAddress, setPeerAddress] = useState(() => localStorage.getItem("xmtp_peer") || DEFAULT_PEER);
  const [xmtpEnv, setXmtpEnv] = useState(() => localStorage.getItem("xmtp_env") || "dev");
  const [burnerPrivateKey, setBurnerPrivateKey] = useState(() => localStorage.getItem("xmtp_burner_pk") || "");
  const [wcProjectId, setWcProjectId] = useState(() => localStorage.getItem("wc_project_id") || process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || "");

  const logDebug = (message) => {
    const ts = new Date().toISOString().split("T")[1].replace("Z", "");
    const line = `[${ts}] ${message}`;
    console.log("[XMTP DEBUG]", line);
    // No longer adding to chat history - console only
  };

  const formatMessageContent = (content) => {
    if (typeof content === "string") return content;
    try { return JSON.stringify(content, null, 2); } catch (_) { return String(content); }
  };

  const classifyMessageSender = (m, knownInboxId, knownWalletLower) => {
    const id = m.id || m?.messageId;
    const fromInbox = m.senderInboxId || m?.fromInboxId || m?.sender?.inboxId;
    const fromAddr = ((m.senderAddress || m?.from || m?.sender?.address || "") + "").toLowerCase();
    const isSelf = (knownInboxId && fromInbox && fromInbox === knownInboxId) || (knownWalletLower && fromAddr && fromAddr === knownWalletLower);
    const sender = isSelf ? 'User' : 'Cthulhu';
    try {
      const keys = Object.keys(m || {});
      logDebug(`[MSG] id=${id || 'n/a'} keys=${keys.join(',')} fromAddr=${fromAddr || 'n/a'} fromInbox=${fromInbox || 'n/a'} selfInboxId=${knownInboxId || 'n/a'} wallet=${knownWalletLower || 'n/a'} isSelf=${isSelf} sender=${sender}`);
    } catch (_) {}
    return sender;
  };

  useEffect(() => {
    // Surface uncaught errors into the chat log for easier debugging
    const onUnhandledRejection = (e) => logDebug(`UnhandledRejection: ${e?.reason?.message || e?.reason || e}`);
    const onError = (e) => logDebug(`Error: ${e?.message || e}`);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError);
    };
  }, []);


  useEffect(() => { localStorage.setItem("xmtp_peer", peerAddress); }, [peerAddress]);
  useEffect(() => { localStorage.setItem("xmtp_env", xmtpEnv); }, [xmtpEnv]);
  useEffect(() => { localStorage.setItem("wc_project_id", wcProjectId || ""); }, [wcProjectId]);
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const toIdentifier = (address) => ({ identifier: address, identifierKind: "Ethereum" });

  const wrapEthersSignerAsXmtpSigner = (ethersSigner) => ({
    type: "EOA",
    getIdentifier: async () => toIdentifier(await ethersSigner.getAddress()),
    signMessage: async (message) => {
      const sig = await ethersSigner.signMessage(message);
      return Uint8Array.from(Buffer.from(sig.replace(/^0x/, ""), "hex"));
    },
  });

  const initXMTPWithEthersSigner = async (ethersSigner) => {
    setIsWaiting(true);
    setStatusText("Creating XMTP client...");
    const t0 = performance.now();
    const warnTimeout = setTimeout(() => {
      logDebug("Still connecting after 15s. If this persists, XMTP dev may be unreachable or signature prompts were dismissed.");
    }, 15000);
    try {
      const address = await ethersSigner.getAddress();
      setWalletAddress(address);
      logDebug(`Initializing XMTP (v3). env=${xmtpEnv}, peer=${peerAddress}, address=${address}`);

      // Quick check: resolve inbox id for peer
      try {
        const utils = new Utils(true);
        const inboxId = await utils.getInboxIdForIdentifier(toIdentifier(peerAddress), xmtpEnv);
        logDebug(`Peer inboxId (${peerAddress}) -> ${inboxId || 'not found'}`);
      } catch (e) {
        logDebug(`Utils.getInboxIdForIdentifier(peer) failed: ${e?.message || e}`);
      }

      const xmtpSigner = wrapEthersSignerAsXmtpSigner(ethersSigner);
      console.time("Client.create");
      const client = await Client.create(xmtpSigner, { env: xmtpEnv, loggingLevel: "debug", structuredLogging: false, performanceLogging: false });
      console.timeEnd("Client.create");
      setStatusText("Checking registration...");

      // Capture known identifiers synchronously for reliable classification
      const knownWalletLower = (address || "").toLowerCase();
      const knownInboxId = client?.inboxId || null;
      if (knownInboxId) {
        logDebug(`Self inboxId -> ${knownInboxId}`);
      }

      // Capture our inbox id for sender classification
      if (!knownInboxId) {
        try {
          const utils = new Utils(true);
          const myInbox = await utils.getInboxIdForIdentifier(toIdentifier(address), xmtpEnv);
          logDebug(`Resolved self inboxId -> ${myInbox || 'not found'}`);
        } catch (e) {
          logDebug(`Resolving self inboxId failed: ${e?.message || e}`);
        }
      }

      try {
        const registered = await client.isRegistered();
        logDebug(`Client isRegistered -> ${registered}`);
      } catch (e) {
        logDebug(`isRegistered() failed: ${e?.message || e}`);
      }

      // Check reachability
      setStatusText("Checking peer reachability...");
      const id = toIdentifier(peerAddress);
      try {
        const result = await client.canMessage([id]);
        const first = [...result.values()][0];
        logDebug(`canMessage(${peerAddress}) -> ${Boolean(first)}`);
      } catch (e) {
        logDebug(`canMessage check failed: ${e?.message || e}`);
      }

      // Create DM
      setStatusText("Opening DM...");
      console.time("conversations.newDmWithIdentifier");
      const dm = await client.conversations.newDmWithIdentifier(id);
      console.timeEnd("conversations.newDmWithIdentifier");
      setXmtpConversation(dm);
      

      // Load history
      setStatusText("Loading messages...");
      console.time("dm.messages");
      const existing = await dm.messages();
      console.timeEnd("dm.messages");
      logDebug(`Loaded ${existing.length} messages.`);
      const resolved = existing.map(m => {
        const msgId = m.id || m?.messageId;
        if (msgId) seenMessageIdsRef.current.add(msgId);
        const sender = classifyMessageSender(m, knownInboxId, knownWalletLower);
        return { sender, message: formatMessageContent(m.content) };
      }).filter(m => m.sender !== 'User');
      setChatHistory(resolved);

      // Stream
      setStatusText("Starting stream...");
      const stream = await dm.stream();
      logDebug("Stream created, listening for messages...");
      streamTaskRef.current = (async () => {
        try {
          for await (const m of stream) {
            logDebug(`Stream received message: ${m.id || 'no-id'}`);
            const id = m.id || m?.messageId;
            if (id && seenMessageIdsRef.current.has(id)) {
              logDebug(`Skipping duplicate message: ${id}`);
              continue;
            }
            const sender = classifyMessageSender(m, knownInboxId, knownWalletLower);
            if (id) seenMessageIdsRef.current.add(id);
            if (sender === 'User') {
              logDebug(`Skipping own message: ${id}`);
              continue;
            }
            logDebug(`Adding ${sender} message to chat: ${formatMessageContent(m.content).slice(0, 50)}...`);
            setChatHistory(prev => [...prev, { sender, message: formatMessageContent(m.content) }]);
            setIsCthulhuThinking(false); // Hide thinking when response arrives
          }
        } catch (error) {
          logDebug(`Stream error: ${error?.message || error}`);
        }
      })();
      logDebug("XMTP conversation ready.");
      setStatusText("");
      const dt = (performance.now() - t0).toFixed(0);
      logDebug(`Connected in ${dt}ms.`);
    } catch (error) {
      console.error('XMTP init error (outer):', error);
      logDebug(`Failed to initialize XMTP: ${error?.message || error}`);
      if (error?.stack) logDebug(String(error.stack).slice(0, 500));
      setStatusText("Initialization failed");
    } finally {
      clearTimeout(warnTimeout);
      setIsWaiting(false);
    }
  };

  // Removed WalletConnect flow

  // Removed injected-provider connect flow

  const connectWithBurner = async () => {
    try {
      let pk = burnerPrivateKey;
      if (!pk) {
        const wallet = ethers.Wallet.createRandom();
        pk = wallet.privateKey;
        localStorage.setItem("xmtp_burner_pk", pk);
        setBurnerPrivateKey(pk);
        logDebug(`Generated new in-browser identity (${wallet.address}).`);
      } else {
        const addr = new ethers.Wallet(pk).address;
        logDebug(`Using existing in-browser identity (${addr}).`);
      }
      const wallet = new ethers.Wallet(pk);
      await initXMTPWithEthersSigner(wallet);
    } catch (error) {
      console.error('Burner identity error:', error);
      logDebug(`Failed to use burner identity: ${error?.message || error}`);
    }
  };

  const loadIdentityFromFile = async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      const pk = data?.privateKey || data?.private_key || data?.pk;
      if (!pk) { logDebug('Invalid identity file: missing privateKey'); return; }
      localStorage.setItem("xmtp_burner_pk", pk);
      setBurnerPrivateKey(pk);
      logDebug('Loaded identity from file. Connecting...');
      const wallet = new ethers.Wallet(pk);
      await initXMTPWithEthersSigner(wallet);
    } catch (e) {
      logDebug(`Failed to load identity: ${e?.message || e}`);
    } finally {
      if (identityFileInputRef.current) identityFileInputRef.current.value = '';
    }
  };

  const exportBurnerIdentity = () => {
    if (!burnerPrivateKey) { logDebug('No in-browser identity to export.'); return; }
    const data = { type: 'xmtp-burner-identity', createdAt: new Date().toISOString(), env: xmtpEnv, privateKey: burnerPrivateKey };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `xmtp-identity-${xmtpEnv}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const clearBurnerIdentity = () => {
    localStorage.removeItem("xmtp_burner_pk");
    setBurnerPrivateKey("");
    logDebug('Cleared in-browser identity.');
  };

  const clearAllCache = () => {
    localStorage.removeItem("xmtp_peer");
    localStorage.removeItem("xmtp_env");
    localStorage.removeItem("xmtp_burner_pk");
    localStorage.removeItem("wc_project_id");
    setPeerAddress(DEFAULT_PEER);
    setXmtpEnv("dev");
    setBurnerPrivateKey("");
    setWcProjectId("");
    logDebug("Cleared all XMTP cache and reset to defaults.");
  };

  const startNewConversation = () => {
    setChatHistory([]);
  };

  const handleNewConversation = async () => {
    if (!xmtpConversation) {
      await connectWithBurner();
      return;
    }
    startNewConversation();
  };

  const handleSendMessage = async () => {
    if (input.trim() === "") return;
    if (!xmtpConversation) { logDebug('Connect XMTP first.'); return; }
    const toSend = input; setInput("");
    setChatHistory((prev) => [...prev, { sender: "User", message: toSend }]);
    setIsCthulhuThinking(true); // Show thinking indicator
    try { await xmtpConversation.send(toSend); }
    catch (error) { 
      console.error("Error sending XMTP message:", error); 
      logDebug(`Send failed: ${error?.message || error}`);
      setIsCthulhuThinking(false); // Hide on error
    }
  };



  return (
    <ChakraProvider theme={customTheme}>
      <Box maxWidth="100%" height="100vh" margin="auto" p={4} bg="black" position="relative" _before={{ content: '""', position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1 }}>
        <Box position="absolute" top={0} right={0} bottom={0} left={0} backgroundImage="url('/tentacle-bg.png')" backgroundSize="cover" backgroundPosition="center" opacity={0.7} zIndex={0} />
        <Box position="relative" zIndex={2}>
          <Text fontSize="3xl" fontWeight="bold" mb={4} color="green.300" textAlign="center">A̶̢̗͌N̷̬͕͋S̵͍͌̄W̴̧̤̋E̸͖̪͕̍͒͊R̶̭̎́ ̵̘͙̞̈́̓T̶̺̣͉͆H̴̖̐̃͝E̷͉̥͊ͅ ̴̢̤̣͛̌C̴̜̑Ą̷̡̋L̴̮͗̾̿L̵̛͔</Text>
          <Flex direction="column" mb={4}>
            <Flex alignItems="center" mb={2} wrap="wrap" gap={2}>

              <Button onClick={handleNewConversation} bg="green.700" color="green.100" _hover={{ bg: "green.600" }} size="sm" mr={2}>Answer The Call</Button>
            </Flex>
            <Flex alignItems="center" gap={2} wrap="wrap">
              <Select value={xmtpEnv} onChange={(e) => setXmtpEnv(e.target.value)} size="sm" bg="green.900" color="green.100" borderColor="green.500" width="160px">
                <option value="dev">XMTP dev</option>
                <option value="production">XMTP production</option>
              </Select>
              <Input value={peerAddress} onChange={(e) => setPeerAddress(e.target.value)} placeholder="Peer address or ENS" bg="green.900" color="green.100" borderColor="green.500" _placeholder={{ color: "green.500" }} _focus={{ borderColor: "green.300" }} size="sm" width="360px" />
              <Input value={wcProjectId} onChange={(e) => setWcProjectId(e.target.value)} placeholder="WalletConnect Project ID" bg="green.900" color="green.100" borderColor="green.500" _placeholder={{ color: "green.500" }} _focus={{ borderColor: "green.300" }} size="sm" width="280px" />
              {!walletAddress ? (
                <HStack>
                  <Button onClick={() => identityFileInputRef.current && identityFileInputRef.current.click()} bg="green.800" color="green.100" _hover={{ bg: "green.700" }} size="sm">Load Identity</Button>
                  <input type="file" accept="application/json" ref={identityFileInputRef} onChange={loadIdentityFromFile} style={{ display: 'none' }} />
                </HStack>
              ) : (
                <Box bg="green.700" p={2} borderRadius="md"><Text color="green.100" fontSize="sm">Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)} → {peerAddress} ({xmtpEnv})</Text></Box>
              )}
              {burnerPrivateKey && (
                <HStack>
                  <Button onClick={exportBurnerIdentity} bg="green.700" color="green.100" _hover={{ bg: "green.600" }} size="sm">Export Identity</Button>
                  <Button onClick={clearBurnerIdentity} bg="red.700" color="white" _hover={{ bg: "red.600" }} size="sm">Clear Identity</Button>
                  <Button onClick={clearAllCache} bg="orange.700" color="white" _hover={{ bg: "orange.600" }} size="sm">Clear All Cache</Button>
                </HStack>
              )}
            </Flex>
          </Flex>

          <VStack ref={chatContainerRef} spacing={4} align="stretch" height="calc(100vh - 350px)" overflowY="auto" borderWidth={2} borderColor="green.500" borderRadius="md" p={4} mb={4} bg="rgba(0, 0, 0, 0.7)">
            {chatHistory.map((chat, index) => (
              <Box key={index} alignSelf={chat.sender === "User" ? "flex-end" : "flex-start"} bg={chat.sender === "User" ? "green.700" : "green.900"} p={3} borderRadius="md" maxWidth="80%">
                <Text fontWeight="bold" color="green.300">{chat.sender}</Text>
                <Text color="green.100">{chat.message}</Text>
              </Box>
            ))}
            {(isWaiting || statusText) && (
              <Flex justify="flex-start" align="center" mt={2}>
                <Spinner size="sm" color="green.500" mr={2} />
                <Text color="green.500" fontSize="sm">{statusText || 'Connecting...'}</Text>
              </Flex>
            )}
            {isCthulhuThinking && (
              <Box alignSelf="flex-start" bg="green.900" p={3} borderRadius="md" maxWidth="80%">
                <Text fontWeight="bold" color="green.300">Cthulhu</Text>
                <Flex align="center">
                  <Spinner size="sm" color="green.500" mr={2} />
                  <Text color="green.100" fontStyle="italic">is thinking...</Text>
                </Flex>
              </Box>
            )}
          </VStack>



          <HStack>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your message..." onKeyPress={(e) => e.key === "Enter" && handleSendMessage()} bg="green.900" color="green.100" borderColor="green.500" _placeholder={{ color: "green.500" }} _focus={{ borderColor: "green.300" }} />

            <Button onClick={handleSendMessage} bg="green.700" color="black" _hover={{ bg: "green.600" }} isDisabled={!xmtpConversation}>Send</Button>
          </HStack>
        </Box>
      </Box>
    </ChakraProvider>
  );
}

export default App;


