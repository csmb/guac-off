import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { useState } from 'react';

const GameContainer = styled.div`
  width: 100vw;
  height: 100vh;
  background: #000;
  position: relative;
  overflow: hidden;
  image-rendering: pixelated;
  font-family: 'Press Start 2P', cursive;
`;

const GoldenGate = styled(motion.div)`
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 60%;
  background: url('/images/golden-gate-pixel.png') no-repeat center bottom;
  background-size: contain;
  filter: hue-rotate(300deg) brightness(0.7) contrast(1.2);
  z-index: 1;
`;

const Sky = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 40%;
  background: linear-gradient(to bottom, #8b0000, #4b0000);
  z-index: 0;
`;

const Player = styled(motion.div)`
  position: absolute;
  bottom: 20%;
  left: 20%;
  width: 64px;
  height: 64px;
  background: url('/images/metal-dude.png') no-repeat center;
  background-size: contain;
  z-index: 2;
  cursor: pointer;
`;

const InventoryBar = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 80px;
  background: rgba(0, 0, 0, 0.8);
  border-top: 2px solid #8b0000;
  display: flex;
  gap: 10px;
  padding: 10px;
  z-index: 10;
`;

const InventoryItem = styled(motion.div)`
  width: 60px;
  height: 60px;
  background: #333;
  border: 2px solid #8b0000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  
  &:hover {
    border-color: #ff0000;
  }
`;

const ItemIcon = styled.img`
  width: 40px;
  height: 40px;
  image-rendering: pixelated;
`;

const DialogBox = styled(motion.div)`
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #8b0000;
  padding: 20px;
  color: #fff;
  font-size: 12px;
  line-height: 1.5;
  z-index: 5;
`;

const initialInventory = [
  { id: 1, name: 'Leather Jacket', icon: '/images/jacket.png' },
  { id: 2, name: 'Cassette Tape', icon: '/images/tape.png' },
  { id: 3, name: 'Metal Zine', icon: '/images/zine.png' },
];

export const MetalAdventure = () => {
  const [inventory, setInventory] = useState(initialInventory);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogText, setDialogText] = useState('');

  const handleItemClick = (item: typeof initialInventory[0]) => {
    setDialogText(`"${item.name}... This might come in handy."`);
    setShowDialog(true);
    setTimeout(() => setShowDialog(false), 3000);
  };

  return (
    <GameContainer>
      <Sky />
      <GoldenGate
        animate={{
          filter: ['hue-rotate(300deg)', 'hue-rotate(310deg)', 'hue-rotate(300deg)'],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <Player
        drag
        dragConstraints={{ left: 0, right: window.innerWidth - 64, top: 0, bottom: window.innerHeight - 64 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      />
      <InventoryBar>
        {inventory.map(item => (
          <InventoryItem
            key={item.id}
            onClick={() => handleItemClick(item)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ItemIcon src={item.icon} alt={item.name} />
          </InventoryItem>
        ))}
      </InventoryBar>
      {showDialog && (
        <DialogBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          {dialogText}
        </DialogBox>
      )}
    </GameContainer>
  );
}; 