import React, { useState, useRef, useEffect } from "react";
import {
  ChakraProvider,
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  IconButton,
  Flex,
  Spacer,
} from "@chakra-ui/react";
import { AttachmentIcon } from "@chakra-ui/icons";
import { customTheme } from "./theme";
import { generateEldritchName } from "./utils";

function App() {
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [userId, setUserId] = useState("");
  const [generatedName, setGeneratedName] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [userScore, setUserScore] = useState(0);
  const [userNotes, setUserNotes] = useState("");
  const [updatedNotes, setUpdatedNotes] = useState("");
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    const storedUserScore = localStorage.getItem("userScore");
    console.log('Initial load - Stored User ID:', storedUserId);
    console.log('Initial load - Stored User Score:', storedUserScore);
    if (storedUserId) {
      setUserId(storedUserId);
      const parsedScore = parseInt(storedUserScore) || 0;
      setUserScore(parsedScore);
      console.log('Initial load - Setting User ID:', storedUserId);
      console.log('Initial load - Setting User Score:', parsedScore);
    } else {
      const generatedName = generateEldritchName();
      setUserId(generatedName);
      setGeneratedName(generatedName);
      setUserScore(0);
      localStorage.setItem("userId", generatedName);
      console.log('Initial load - New user, setting ID:', generatedName);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("userScore", userScore.toString());
    console.log('User score saved to localStorage:', userScore);
  }, [userScore]);

  useEffect(() => {
    if (userId) {
      localStorage.setItem("userId", userId);
      console.log('User ID saved to localStorage:', userId);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      const generatedName = generateEldritchName();
      setUserId(generatedName);
      setGeneratedName(generatedName);
    }
  }, [userId]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (input.trim() === "" || !userId) return;

    console.log('Sending message with current userScore:', userScore);

    // Add user message to chat history
    setChatHistory((prev) => [...prev, { sender: "User", message: input }]);

    // Send message to backend API
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          user_id: userId,
          conversation_id: conversationId,
          user_score: userScore,
          user_notes: userNotes
        }),
      });
      const data = await response.json();
      console.log('Received response from backend:', data);

      // Add Cthulhu bot message to chat history
      setChatHistory((prev) => [...prev, { sender: "Cthulhu", message: data.message }]);

      // Update conversation_id if it's a new conversation
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
        console.log('Updated conversation_id:', data.conversation_id);
      }

      // Update user score and notes
      if (data.updated_score !== undefined) {
        console.log('Updating user score from', userScore, 'to', data.updated_score);
        setUserScore(data.updated_score);
      }
      if (data.updated_notes !== undefined) {
        console.log('Updating user notes:', data.updated_notes);
        setUpdatedNotes(data.updated_notes);
      }

      console.log('Final data after processing:', data);
    } catch (error) {
      console.error("Error sending message:", error);
      setChatHistory((prev) => [...prev, { sender: "System", message: "Error: Unable to send message" }]);
    }

    setInput("");
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file && userId) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', userId);

      try {
        const response = await fetch('/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (response.ok) {
          console.log("File uploaded successfully:", data.filename);
          setUploadedFile(data.filename);
        } else {
          console.error("File upload failed:", data.error);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }
  };

  return (
    <ChakraProvider theme={customTheme}>
      <Box
        maxWidth="100%"
        height="100vh"
        margin="auto"
        p={4}
        bg="black"
        position="relative"
        _before={{
          content: '""',
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: "rgba(0,0,0,0.5)", // Adjust this value to control darkness
          zIndex: 1
        }}
      >
        <Box
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          backgroundImage="url('/tentacle-bg.png')"
          backgroundSize="cover"
          backgroundPosition="center"
          opacity={0.7} // Adjust this value to control image opacity
          zIndex={0}
        />
        <Box position="relative" zIndex={2}>
          <Text fontSize="3xl" fontWeight="bold" mb={4} color="green.300" textAlign="center">
            A̶̢̗͌N̷̬͕͋S̵͍͌̄W̴̧̤̋E̸͖̪͕̍͒͊R̶̭̎́ ̵̘͙̞̈́̓T̶̺̣͉͆H̴̖̐̃͝E̷͉̥͊ͅ ̴̢̤̣͛̌C̴̜̑Ą̷̡̋L̴̮͗̾̿L̵̛͔
          </Text>
          <Flex direction="column" mb={4}>
            <Flex alignItems="center" mb={2}>
              <Input
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  console.log('User ID changed:', e.target.value);
                }}
                placeholder={generatedName || "Enter your User ID"}
                bg="green.900"
                color="green.100"
                borderColor="green.500"
                _placeholder={{ color: "green.500" }}
                _focus={{ borderColor: "green.300" }}
                size="sm"
                width="250px"
                mr={2}
              />
              <Box
                bg="green.700"
                p={2}
                borderRadius="md"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text color="green.100" fontWeight="bold" fontSize="lg">
                  Score: {userScore}
                </Text>
              </Box>
            </Flex>
          </Flex>
          {updatedNotes && (
            <Box mb={4} p={2} bg="green.700" borderRadius="md">
              <Text color="green.100">Updated Notes: {updatedNotes}</Text>
            </Box>
          )}
          <VStack
            ref={chatContainerRef}
            spacing={4}
            align="stretch"
            height="calc(100vh - 350px)"
            overflowY="auto"
            borderWidth={2}
            borderColor="green.500"
            borderRadius="md"
            p={4}
            mb={4}
            bg="rgba(0, 0, 0, 0.7)"
          >
            {chatHistory.map((chat, index) => (
              <Box
                key={index}
                alignSelf={chat.sender === "User" ? "flex-end" : "flex-start"}
                bg={chat.sender === "User" ? "green.700" : "green.900"}
                p={3}
                borderRadius="md"
                maxWidth="80%"
              >
                <Text fontWeight="bold" color="green.300">{chat.sender}</Text>
                <Text color="green.100">{chat.message}</Text>
              </Box>
            ))}
          </VStack>
          {uploadedFile && (
            <Box mb={4} p={2} bg="green.700" borderRadius="md">
              <Text color="green.100">Uploaded: {uploadedFile}</Text>
            </Box>
          )}
          <HStack>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              bg="green.900"
              color="green.100"
              borderColor="green.500"
              _placeholder={{ color: "green.500" }}
              _focus={{ borderColor: "green.300" }}
            />
            <IconButton
              icon={<AttachmentIcon />}
              onClick={() => fileInputRef.current.click()}
              aria-label="Attach file"
              bg="green.700"
              color="black"
              _hover={{ bg: "green.600" }}
            />
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            <Button
              onClick={handleSendMessage}
              bg="green.700"
              color="black"
              _hover={{ bg: "green.600" }}
            >
              Send
            </Button>
          </HStack>
        </Box>
      </Box>
    </ChakraProvider>
  );
}

export default App;


