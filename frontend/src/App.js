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
  const fileInputRef = useRef(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const generatedName = generateEldritchName();
      setUserId(generatedName);
      setGeneratedName(generatedName);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      localStorage.setItem("userId", userId);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      const generatedName = generateEldritchName();
      setUserId(generatedName);
      setGeneratedName(generatedName);
    }
  }, [userId]);

  const handleSendMessage = async () => {
    if (input.trim() === "" || !userId) return;

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
          conversation_id: conversationId
        }),
      });
      const data = await response.json();

      // Add Cthulhu bot message to chat history
      setChatHistory((prev) => [...prev, { sender: "Cthulhu", message: data.message }]);

      // Update conversation_id if it's a new conversation
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      console.log(data);
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
        backgroundImage="url('https://example.com/tentacle-background.jpg')"
        backgroundSize="cover"
        backgroundPosition="center"
      >
        <Text fontSize="3xl" fontWeight="bold" mb={4} color="green.300" textAlign="center">
          Chat with Cthulhu
        </Text>
        <Input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder={generatedName || "Enter your User ID"}
          mb={4}
          bg="green.900"
          color="green.100"
          borderColor="green.500"
          _placeholder={{ color: "green.500" }}
          _focus={{ borderColor: "green.300" }}
          size="sm"
          width="250px"
        />
        <VStack
          spacing={4}
          align="stretch"
          height="calc(100vh - 300px)"
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
    </ChakraProvider>
  );
}

export default App;


