import React from "react";

import { PortalProvider } from "./example/lib/PortalProvider";
import { NightshadeArcadePortalProvider } from "./nightshade-arcade/lib/NightshadeArcadePortalProvider";
import { Ocean } from "features/world/ui/Ocean";

import { WalletProvider } from "features/wallet/WalletProvider";

import { PortalExample } from "./example/PortalExample";
import { NightshadeArcade } from "./nightshade-arcade/NightshadeArcade";
import { CONFIG } from "lib/config";
import { createPortal } from "react-dom";
import { SUNNYSIDE } from "assets/sunnyside";
import { PIXEL_SCALE } from "features/game/lib/constants";

/**
 * Portal background without the brightness filter that Ocean applies
 */
const PortalBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return createPortal(
    <div
      style={{
        backgroundColor: "#63c74d",
        backgroundRepeat: "repeat",
        backgroundImage: `url(${SUNNYSIDE.decorations.ocean})`,
        backgroundSize: `${64 * PIXEL_SCALE}px`,
        imageRendering: "pixelated",
        // No brightness filter for portals - we want full brightness
      }}
      className="absolute inset-0 overflow-hidden w-screen h-screen"
    >
      {children}
    </div>,
    document.body,
  );
};

export const PortalApp: React.FC = () => {
  return (
    <WalletProvider>
      <NightshadeArcadePortalProvider>
        <PortalBackground>
          <NightshadeArcade />
        </PortalBackground>
      </NightshadeArcadePortalProvider>
    </WalletProvider>
  );
};
