import { MetalAdventure } from './components/MetalAdventure';
import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    background: #000;
    color: #fff;
    font-family: 'Press Start 2P', cursive;
  }

  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
`;

function App() {
  return (
    <>
      <GlobalStyle />
      <MetalAdventure />
    </>
  );
}

export default App;
