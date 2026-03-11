    /* ===== TOP HUD / FRAMELESS PREMIUM ===== */
    #hudTop {
      position: fixed;
      left: var(--sal);
      right: var(--sar);
      top: var(--sat);
      padding: 10px 16px 0;
      z-index: 9998;
      pointer-events: auto;
      box-sizing: border-box;
    }

    #hudTop,
    #hudTop * {
      touch-action: auto;
      -webkit-user-select: none;
      user-select: none;
      box-sizing: border-box;
    }

    #hudRow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(320px, 390px);
      align-items: start;
      gap: 12px;
      max-width: 1120px;
      margin: 0 auto;
    }

    .hudPanel {
      position: relative;
      min-width: 0;
      border: 0;
      background: transparent;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      box-shadow: none;
      border-radius: 0;
      padding: 0;
    }

    #hudLeft {
      justify-self: start;
      width: min(100%, 360px);
      display: grid;
      gap: 7px;
      align-content: start;
      min-width: 0;
      padding: 8px 10px 7px;
      border-radius: 20px;
      background:
        radial-gradient(120% 160% at 0% 0%, rgba(86, 146, 255, 0.16), transparent 38%),
        radial-gradient(120% 160% at 100% 0%, rgba(126, 83, 255, 0.12), transparent 36%),
        linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015));
      box-shadow:
        0 10px 24px rgba(0,0,0,0.22),
        inset 0 1px 0 rgba(255,255,255,0.05);
      backdrop-filter: blur(7px);
      -webkit-backdrop-filter: blur(7px);
    }

    #hudIdentity {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    #hudAvatarWrap {
      position: relative;
      width: 40px;
      height: 40px;
    }

    #hudAvatarWrap::after {
      content: "";
      position: absolute;
      right: -1px;
      bottom: -1px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #2fff86;
      border: 2px solid rgba(7,10,18,0.95);
      box-shadow:
        0 0 10px rgba(47,255,134,0.70),
        0 0 4px rgba(47,255,134,0.48);
    }

    #hudAvatar {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.18);
      background:
        linear-gradient(135deg, rgba(60,145,255,0.95), rgba(104,74,255,0.92));
      box-shadow:
        0 6px 14px rgba(0,0,0,0.28),
        0 0 16px rgba(80,150,255,0.24),
        inset 0 1px 0 rgba(255,255,255,0.16);
    }

    #hudAvatarImg,
    #hudAvatarFallback {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
    }

    #hudAvatarImg {
      display: none;
      object-fit: cover;
    }

    #hudAvatarFallback {
      display: grid;
      place-items: center;
      color: rgba(255,255,255,0.98);
      font-size: 14px;
      font-weight: 1000;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    #hudUserMeta {
      min-width: 0;
      display: grid;
      gap: 4px;
    }

    #hudBadges {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      min-width: 0;
    }

    .hudBadge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 18px;
      padding: 0 8px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 1000;
      letter-spacing: 0.08em;
      line-height: 1;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.10);
      text-shadow: 0 1px 1px rgba(0,0,0,0.28);
    }

    #hudOnlineBadge {
      color: #effff5;
      background:
        linear-gradient(180deg, rgba(45,189,108,0.30), rgba(20,94,55,0.18));
      box-shadow:
        0 0 12px rgba(45,189,108,0.18),
        inset 0 1px 0 rgba(255,255,255,0.05);
    }

    #hudPremiumBadge {
      display: none;
      color: #fff1c6;
      background:
        linear-gradient(180deg, rgba(255,183,53,0.30), rgba(146,88,8,0.18));
      box-shadow:
        0 0 14px rgba(255,173,50,0.16),
        inset 0 1px 0 rgba(255,255,255,0.06);
    }

    #hudUsername {
      min-width: 0;
      color: rgba(255,255,255,0.98);
      font-size: 14px;
      font-weight: 1000;
      line-height: 1.05;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-shadow:
        0 1px 0 rgba(0,0,0,0.30),
        0 0 8px rgba(255,255,255,0.04);
    }

    #hudCoinsRow {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      font-size: 13px;
      font-weight: 1000;
      line-height: 1;
    }

    #hudCoinIcon {
      width: 17px;
      height: 17px;
      display: inline-block;
      flex: 0 0 auto;
      filter:
        drop-shadow(0 2px 8px rgba(0,0,0,0.34))
        drop-shadow(0 0 10px rgba(255,192,68,0.22));
    }

    #hudCoins {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #ffe29a;
      text-shadow:
        0 0 10px rgba(255,197,58,0.14),
        0 1px 0 rgba(0,0,0,0.28);
    }

    #hudWeaponRow {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      color: rgba(255,255,255,0.76);
      font-size: 11px;
      font-weight: 800;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-shadow: 0 1px 0 rgba(0,0,0,0.24);
    }

    #hudWeaponBonus {
      color: #8ed9ff;
      font-weight: 1000;
      text-shadow: 0 0 10px rgba(74,195,255,0.14);
    }

    #hudLogoWrap {
      align-self: start;
      justify-self: center;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      padding-top: 4px;
    }

    #hudLogo {
      height: 44px;
      width: auto;
      max-width: 170px;
      display: block;
      object-fit: contain;
      opacity: 0.92;
      filter:
        drop-shadow(0 8px 16px rgba(0,0,0,0.34))
        drop-shadow(0 0 14px rgba(255,140,60,0.10));
    }

    #hudRight {
      justify-self: end;
      width: min(100%, 390px);
      display: grid;
      gap: 9px;
      align-content: start;
      min-width: 0;
      padding-top: 2px;
    }

    .bar {
      position: relative;
      height: 34px;
      border-radius: 999px;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03)),
        rgba(12,16,28,0.38);
      border: 1px solid rgba(255,255,255,0.10);
      box-shadow:
        0 6px 16px rgba(0,0,0,0.22),
        inset 0 1px 0 rgba(255,255,255,0.08);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }

    .barFill {
      position: relative;
      height: 100%;
      width: 0%;
      min-width: 3%;
      border-radius: inherit;
      transition: width 180ms ease;
      overflow: hidden;
    }

    .barFill::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.00) 48%);
      pointer-events: none;
    }

    .barFill::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(
        110deg,
        transparent 0%,
        rgba(255,255,255,0.00) 34%,
        rgba(255,255,255,0.16) 50%,
        rgba(255,255,255,0.00) 66%,
        transparent 100%
      );
      transform: translateX(-120%);
      animation: hudSheen 2.6s linear infinite;
      pointer-events: none;
    }

    #hudXpFill {
      background:
        linear-gradient(90deg, #8a63ff 0%, #3ba7ff 100%);
      box-shadow:
        0 0 18px rgba(91,135,255,0.24),
        inset 0 1px 0 rgba(255,255,255,0.18);
    }

    #hudEnergyFill {
      background:
        linear-gradient(90deg, #3fe08d 0%, #17d7ff 100%);
      box-shadow:
        0 0 18px rgba(54,227,144,0.22),
        inset 0 1px 0 rgba(255,255,255,0.18);
    }

    .barText {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 12px;
      color: rgba(255,255,255,0.98);
      font-size: 12px;
      font-weight: 1000;
      letter-spacing: 0.04em;
      pointer-events: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-shadow:
        0 1px 2px rgba(0,0,0,0.58),
        0 0 10px rgba(0,0,0,0.18);
    }

    @keyframes hudSheen {
      0% { transform: translateX(-120%); }
      100% { transform: translateX(140%); }
    }

    @media (max-width: 720px) {
      #hudTop {
        padding: 8px 10px 0;
      }

      #hudRow {
        grid-template-columns: 1fr;
        gap: 8px;
        max-width: 100%;
      }

      #hudLogoWrap {
        display: none;
      }

      #hudLeft,
      #hudRight {
        width: 100%;
        justify-self: stretch;
      }

      #hudLeft {
        padding: 8px 9px 7px;
        border-radius: 18px;
      }

      #hudIdentity {
        grid-template-columns: 38px minmax(0, 1fr);
        gap: 9px;
      }

      #hudAvatarWrap {
        width: 38px;
        height: 38px;
      }

      #hudUsername {
        font-size: 13px;
      }

      #hudCoinsRow {
        font-size: 12px;
      }

      #hudWeaponRow {
        font-size: 10px;
      }

      .bar {
        height: 32px;
      }

      .barText {
        font-size: 11px;
      }

      #pvpHeader {
        flex-direction: column;
      }

      .pvpBtns {
        width: 100%;
        flex-wrap: wrap;
      }

      #pvpBars {
        grid-template-columns: 1fr;
      }
    }

    @media (min-width: 721px) and (max-width: 980px) {
      #hudTop {
        padding: 9px 12px 0;
      }

      #hudRow {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        align-items: start;
        gap: 10px;
      }

      #hudLogoWrap {
        display: none;
      }

      #hudLeft,
      #hudRight {
        width: 100%;
      }

      #hudLeft {
        padding: 8px 10px 7px;
      }

      .bar {
        height: 33px;
      }
    }
