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
  Spinner,
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
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    const storedUserScore = localStorage.getItem("userScore");
    const storedConversationId = localStorage.getItem("conversationId");
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
    if (storedConversationId) {
      setConversationId(storedConversationId);
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
    console.log('User score changed:', userScore);
  }, [userScore]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const startNewConversation = () => {
    setConversationId(null);
    setChatHistory([]);
    localStorage.removeItem("conversationId");
    console.log("Starting new conversation");
  };

  const handleSendMessage = async () => {
    if (input.trim() === "" || !userId) return;

    console.log('Sending message with current userScore:', userScore);

    // Add user message to chat history
    setChatHistory((prev) => [...prev, { sender: "User", message: input }]);
    setIsWaiting(true);  // Set waiting to true

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
      console.log('Received response from backend:', data);

      // Add Cthulhu bot message to chat history
      setChatHistory((prev) => [...prev, { sender: "Cthulhu", message: data.message }]);

      // Update conversation_id if it's a new conversation
      if (data.conversation_id && data.conversation_id !== conversationId) {
        setConversationId(data.conversation_id);
        localStorage.setItem("conversation_id", data.conversation_id);
        console.log('Updated conversation_id:', data.conversation_id);
      }

      // Update user score and notes
      if (data.updated_score !== undefined) {
        console.log('Updating user score from', userScore, 'to', data.updated_score);
        setUserScore(data.updated_score);
      }
      if (data.user_notes !== undefined) {
        console.log('Updating user notes:', data.user_notes);
        setUserNotes(data.user_notes);
      }

      console.log('Final data after processing:', data);
    } catch (error) {
      console.error("Error sending message:", error);
      setChatHistory((prev) => [...prev, { sender: "System", message: "Error: Unable to send message" }]);
    } finally {
      setIsWaiting(false);  // Set waiting to false regardless of success or failure
    }

    setInput("");
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    console.log("File upload initiated. File:", file, "User ID:", userId);
    if (file && userId) {
      console.log("Starting file upload for user:", userId);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', userId);

      try {
        console.log("Sending file upload request...");
        const response = await fetch('/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        console.log("File upload response received:", data);
        if (response.ok) {
          console.log("File uploaded successfully:", data.filename);
          console.log("File ID received:", data.file_id);
          setUploadedFile(data.filename);

          // Fetch the file score from the new endpoint
          try {
            console.log("Fetching file score for file ID:", data.file_id);
            const scoreResponse = await fetch(`/get_file_score/${data.file_id}`);
            const scoreData = await scoreResponse.json();
            console.log("Score data received:", scoreData);
            if (scoreResponse.ok) {
              setUserScore(prevScore => {
                console.log("Current user score before update:", prevScore);
                const newScore = prevScore + scoreData.score;
                console.log("Calculating new score:", prevScore, "+", scoreData.score, "=", newScore);
                localStorage.setItem("userScore", newScore.toString());
                console.log("Updated user score in localStorage:", newScore);
                return newScore;
              });
              console.log("setUserScore called. New score should be applied.");
            } else {
              console.error("Failed to fetch file score:", scoreData.error);
            }
          } catch (scoreError) {
            console.error("Error fetching file score:", scoreError);
          }
        } else {
          console.error("File upload failed:", data.error);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    } else {
      console.log("File upload aborted: No file selected or no user ID", { file, userId });
    }
    console.log("File upload process completed. Current user score:", userScore);
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
                mr={2}
              >
                <Text color="green.100" fontWeight="bold" fontSize="lg">
                  Score: {userScore}
                </Text>
              </Box>
              <Box
                bg="green.700"
                p={2}
                borderRadius="md"
                display="flex"
                alignItems="center"
                justifyContent="center"
                mr={2}
              >
                <Text color="green.100" fontSize="lg">
                  Conv ID: {conversationId || 'N/A'}
                </Text>
              </Box>
              <Button
                onClick={startNewConversation}
                bg="green.700"
                color="green.100"
                _hover={{ bg: "green.600" }}
                size="sm"
              >
                New Conversation
              </Button>
            </Flex>
          </Flex>
          {userNotes && (
            <Box mb={4} p={2} bg="green.700" borderRadius="md">
              <Text color="green.100">Updated Notes: {userNotes}</Text>
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
            {isWaiting && (
              <Flex justify="flex-start" align="center" mt={2}>
                <Spinner size="sm" color="green.500" mr={2} />
                <Text color="green.500" fontSize="sm">Cthulhu is thinking...</Text>
              </Flex>
            )}
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


