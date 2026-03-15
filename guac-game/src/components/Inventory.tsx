import { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { motion } from 'framer-motion';

interface InventoryItem {
  id: number;
  name: string;
  completed: boolean;
  starCollected: boolean;
}

const InventoryContainer = styled.div`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 10px;
  backdrop-filter: blur(5px);
`;

const ItemBox = styled(motion.div)<{ completed: boolean }>`
  width: 80px;
  height: 80px;
  background: ${props => props.completed ? '#4CAF50' : '#333'};
  border: 2px solid #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  overflow: hidden;
`;

const StarIcon = styled(motion.div)`
  color: gold;
  font-size: 40px;
  position: absolute;
  cursor: grab;
  user-select: none;
  
  &:active {
    cursor: grabbing;
  }
`;

const ItemName = styled.div`
  color: white;
  font-size: 12px;
  text-align: center;
  margin-top: 5px;
`;

const Basket = styled(motion.div)`
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 100px;
  height: 100px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px dashed #fff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
`;

const CongratsMessage = styled(motion.div)`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: gold;
  padding: 20px 40px;
  border-radius: 10px;
  font-size: 32px;
  font-weight: bold;
  text-align: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
`;

const initialItems: InventoryItem[] = [
  { id: 1, name: 'Find Guac', completed: false, starCollected: false },
  { id: 2, name: 'Talk to Chef', completed: false, starCollected: false },
  { id: 3, name: 'Get Recipe', completed: false, starCollected: false },
  { id: 4, name: 'Collect Ingredients', completed: false, starCollected: false },
  { id: 5, name: 'Make Guac', completed: false, starCollected: false },
];

export const Inventory = () => {
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [showCongrats, setShowCongrats] = useState(false);
  const [draggedStar, setDraggedStar] = useState<number | null>(null);
  const screamAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Preload the audio file
    screamAudio.current = new Audio('/audio/wilhelm-scream.mp3');
    screamAudio.current.load();
  }, []);

  const playScream = () => {
    if (screamAudio.current) {
      screamAudio.current.currentTime = 0;
      screamAudio.current.play().catch(error => {
        console.error('Error playing audio:', error);
        // Fallback to using the Web Audio API if HTML5 Audio fails
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const request = new XMLHttpRequest();
        request.open('GET', '/audio/wilhelm-scream.mp3', true);
        request.responseType = 'arraybuffer';
        request.onload = () => {
          audioContext.decodeAudioData(request.response, (buffer) => {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
          }, (error) => {
            console.error('Error decoding audio data:', error);
          });
        };
        request.send();
      });
    }
  };

  const toggleItem = (id: number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const handleDragStart = (id: number) => {
    setDraggedStar(id);
  };

  const handleDragEnd = () => {
    if (draggedStar !== null) {
      setItems(items.map(item => 
        item.id === draggedStar ? { ...item, starCollected: true } : item
      ));
      setDraggedStar(null);
    }
  };

  const handleDrop = () => {
    if (draggedStar !== null) {
      playScream();
      setShowCongrats(true);
      setTimeout(() => setShowCongrats(false), 2000);
    }
  };

  return (
    <>
      <InventoryContainer>
        {items.map(item => (
          <div key={item.id}>
            <ItemBox
              completed={item.completed}
              onClick={() => toggleItem(item.id)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {item.completed && !item.starCollected && (
                <StarIcon
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  draggable
                  onDragStart={() => handleDragStart(item.id)}
                  onDragEnd={handleDragEnd}
                >
                  ⭐
                </StarIcon>
              )}
            </ItemBox>
            <ItemName>{item.name}</ItemName>
          </div>
        ))}
      </InventoryContainer>
      <Basket
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        whileHover={{ scale: 1.1 }}
      >
        🧺
      </Basket>
      {showCongrats && (
        <CongratsMessage
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          Congrats! 🎉
        </CongratsMessage>
      )}
    </>
  );
}; 