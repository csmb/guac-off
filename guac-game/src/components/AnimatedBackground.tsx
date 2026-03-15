import styled, { keyframes } from 'styled-components';

const float = keyframes`
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-20px);
  }
  100% {
    transform: translateY(0px);
  }
`;

const BackgroundContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(45deg, #1a2a6c, #b21f1f, #fdbb2d);
  background-size: 400% 400%;
  animation: gradient 15s ease infinite;

  @keyframes gradient {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
`;

const FloatingShape = styled.div<{ size: number; left: number; delay: number }>`
  position: absolute;
  width: ${props => props.size}px;
  height: ${props => props.size}px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  left: ${props => props.left}%;
  animation: ${float} ${props => 3 + props.delay}s ease-in-out infinite;
  animation-delay: ${props => props.delay}s;
`;

export const AnimatedBackground = () => {
  return (
    <BackgroundContainer>
      <FloatingShape size={100} left={10} delay={0} />
      <FloatingShape size={150} left={30} delay={1} />
      <FloatingShape size={80} left={50} delay={2} />
      <FloatingShape size={120} left={70} delay={1.5} />
      <FloatingShape size={90} left={90} delay={0.5} />
    </BackgroundContainer>
  );
}; 