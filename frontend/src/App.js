import React, { useState } from "react";
import {
  ChakraProvider,
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Flex,
  Spacer,
} from "@chakra-ui/react";
import { customTheme } from "./theme";

function App() {
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [userId, setUserId] = useState("user123"); // Temporary user ID
  const [conversationId, setConversationId] = useState(null);

  const handleSendMessage = async () => {
    if (input.trim() === "") return;

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

  return (
    <ChakraProvider theme={customTheme}>
      <Box maxWidth={600} margin="auto" p={4}>
        <Text fontSize="2xl" fontWeight="bold" mb={4}>
          Chat with Cthulhu
        </Text>
        <VStack
          spacing={4}
          align="stretch"
          height="400px"
          overflowY="auto"
          borderWidth={1}
          borderRadius="md"
          p={4}
          mb={4}
        >
          {chatHistory.map((chat, index) => (
            <Box
              key={index}
              alignSelf={chat.sender === "User" ? "flex-end" : "flex-start"}
              bg={chat.sender === "User" ? "blue.100" : "green.100"}
              p={2}
              borderRadius="md"
            >
              <Text fontWeight="bold">{chat.sender}</Text>
              <Text>{chat.message}</Text>
            </Box>
          ))}
        </VStack>
        <HStack>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <Button onClick={handleSendMessage} colorScheme="blue">
            Send
          </Button>
        </HStack>
      </Box>
    </ChakraProvider>
  );
}

export default App;
