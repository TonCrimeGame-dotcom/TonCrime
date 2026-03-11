    /* ===== TOP HUD ===== */
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

    #hudTop, #hudTop * {
      touch-action: auto;
      -webkit-user-select: none;
      user-select: none;
      box-sizing: border-box;
    }

    #hudRow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      gap: 12px;
      max-width: 1120px;
      margin: 0 auto;
    }

    .hudPanel {
      position: relative;
      min-width: 0;
      border-radius: 18px;
      padding: 10px 12px;
      border: 1px solid rgba(255,255,255,0.12);
      background:
        radial-gradient(140% 160% at 0% 0%, rgba(60,140,255,0.16), transparent 38%),
        radial-gradient(140% 160% at 100% 0%, rgba(138,72,255,0.14), transparent 36%),
        linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02)),
        rgba(8, 12, 22, 0.82);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow:
        0 10px 24px rgba(0,0,0,0.28),
        inset 0 1px 0 rgba(255,255,255,0.05),
        0 0 0 1px rgba(255,255,255,0.02);
    }

    #hudLeft {
      justify-self: start;
      width: min(100%, 350px);
      display: grid;
      gap: 7px;
      align-content: center;
      min-width: 0;
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
      background: #3dff8a;
      border: 2px solid rgba(8,12,22,0.96);
      box-shadow:
        0 0 10px rgba(61,255,138,0.65),
        0 0 4px rgba(61,255,138,0.45);
    }

    #hudAvatar {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.18);
      background:
        linear-gradient(135deg, rgba(0,212,255,0.88), rgba(117,53,255,0.9));
      box-shadow:
        0 6px 14px rgba(0,0,0,0.30),
        0 0 16px rgba(64,160,255,0.22),
        inset 0 1px 0 rgba(255,255,255,0.18);
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
      padding: 0 7px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 1000;
      letter-spacing: 0.08em;
      line-height: 1;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
    }

    #hudOnlineBadge {
      color: #eafff3;
      background:
        linear-gradient(180deg, rgba(34,200,100,0.30), rgba(20,98,56,0.22));
    }

    #hudPremiumBadge {
      display: none;
      color: #fff6d7;
      background:
        linear-gradient(180deg, rgba(255,210,74,0.30), rgba(166,116,14,0.22));
      box-shadow:
        0 0 12px rgba(255,193,59,0.16),
        inset 0 1px 0 rgba(255,255,255,0.08);
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
      text-shadow: 0 1px 0 rgba(0,0,0,0.25);
    }

    #hudCoinsRow {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      color: rgba(255,255,255,0.96);
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
        drop-shadow(0 2px 8px rgba(0,0,0,0.36))
        drop-shadow(0 0 10px rgba(255,205,40,0.22));
    }

    #hudCoins {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #ffe89a;
      text-shadow: 0 0 10px rgba(255,211,74,0.14);
    }

    #hudWeaponRow {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      color: rgba(255,255,255,0.74);
      font-size: 11px;
      font-weight: 800;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #hudWeaponBonus {
      color: rgba(145,228,255,0.95);
      font-weight: 1000;
    }

    #hudLogoWrap {
      align-self: center;
      justify-self: center;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      padding-inline: 4px;
    }

    #hudLogo {
      height: 46px;
      width: auto;
      max-width: 180px;
      display: block;
      object-fit: contain;
      filter:
        drop-shadow(0 8px 18px rgba(0,0,0,0.40))
        drop-shadow(0 0 16px rgba(79,154,255,0.12));
      opacity: 0.96;
    }

    #hudRight {
      justify-self: end;
      width: min(100%, 390px);
      display: grid;
      gap: 7px;
      align-content: center;
      min-width: 0;
    }

    .bar {
      position: relative;
      height: 24px;
      border-radius: 999px;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
        rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.05),
        0 4px 10px rgba(0,0,0,0.14);
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

    .barFill::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(
        110deg,
        transparent 0%,
        rgba(255,255,255,0.00) 34%,
        rgba(255,255,255,0.18) 50%,
        rgba(255,255,255,0.00) 66%,
        transparent 100%
      );
      transform: translateX(-120%);
      animation: hudSheen 2.4s linear infinite;
      pointer-events: none;
    }

    #hudXpFill {
      background:
        linear-gradient(90deg, rgba(111,70,255,0.98), rgba(61,189,255,0.98));
      box-shadow:
        0 0 14px rgba(95,132,255,0.28),
        inset 0 1px 0 rgba(255,255,255,0.18);
    }

    #hudEnergyFill {
      background:
        linear-gradient(90deg, rgba(43,227,122,0.98), rgba(0,236,255,0.98));
      box-shadow:
        0 0 14px rgba(41,232,120,0.26),
        inset 0 1px 0 rgba(255,255,255,0.18);
    }

    .barText {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 10px;
      color: rgba(255,255,255,0.98);
      font-size: 10px;
      font-weight: 1000;
      letter-spacing: 0.04em;
      pointer-events: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-shadow:
        0 1px 2px rgba(0,0,0,0.55),
        0 0 8px rgba(0,0,0,0.18);
    }

    @keyframes hudSheen {
      0% { transform: translateX(-120%); }
      100% { transform: translateX(140%); }
    }
