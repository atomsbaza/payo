export const translations = {
  th: {
    // Navbar
    brand: 'Payo',
    navDashboard: 'Dashboard',
    navCreateLink: '+ สร้าง Link',

    // Create page
    createTitle: 'สร้าง Transfer Link',
    createSubtitle: 'เหมือน PromptPay แต่เป็น Crypto — แชร์ link แล้วรับเงินได้เลย',
    labelAddress: 'Wallet Address ผู้รับ',
    addressPlaceholder: '0x...',
    useMyWallet: 'ใช้ของฉัน',
    labelToken: 'Token',
    labelAmount: 'จำนวน (ไม่ระบุ = ให้ผู้โอนกรอกเอง)',
    amountPlaceholder: '0.00',
    labelMemo: 'หมายเหตุ (optional)',
    memoPlaceholder: 'เช่น ของขวัญวันเกิด, กาแฟ, บริจาค',
    createButton: 'สร้าง Transfer Link',
    saveButton: 'บันทึก Link ✓',
    linkReady: 'QR พร้อมแชร์แล้ว! 🎉',
    viewDashboard: 'ดู links ทั้งหมดใน Dashboard →',
    labelExpiry: 'วันหมดอายุของ Link',
    expiryNone: 'ไม่มีวันหมดอายุ',
    expiry1d: '1 วัน',
    expiry7d: '7 วัน',
    expiry30d: '30 วัน',
    expiresOn: (date: string) => `หมดอายุ ${date}`,

    // Pay page
    invalidLink: 'Transfer link ไม่ถูกต้อง',
    invalidLinkDesc: 'ลิงก์นี้อาจหมดอายุหรือเสียหาย',
    expiredLink: 'Transfer link หมดอายุแล้ว',
    expiredLinkDesc: (date: string) => `Transfer link นี้หมดอายุเมื่อ ${date}`,
    labelBalance: 'ยอดคงเหลือ',
    insufficientBalance: 'ยอดไม่พอ',
    paySuccess: 'เงินถึงแล้ว 🎉',
    paySuccessDesc: (amount: string, token: string) => `${amount} ${token} ถึงมือผู้รับแล้ว`,
    viewOnBasescan: 'ดู Transaction บน Basescan ↗',
    payTitle: (amount: string, token: string) => `โอน ${amount} ${token}`,
    payTitleNoAmount: (token: string) => `โอน ${token}`,
    labelRecipient: 'ผู้รับ',
    labelTokenField: 'Token',
    labelNetwork: 'Network',
    networkName: 'Base Sepolia (Testnet)',
    labelCustomAmount: 'จำนวนที่จะโอน',
    errorRejected: 'ยกเลิกการโอน',
    errorInsufficientFunds: 'ยอดไม่เพียงพอสำหรับค่า Gas',
    errorNetwork: 'เกิดข้อผิดพลาดของ network กรุณาลองใหม่',
    errorGeneric: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
    retryBtn: 'ลองใหม่อีกครั้ง',
    retryCount: (n: number) => `ลองแล้ว ${n} ครั้ง`,
    connectToPayBtn: 'Connect Wallet เพื่อโอน',
    waitingWallet: '⏳ รอ approve ใน wallet...',
    waitingConfirm: '⏳ รอ confirmation...',
    payBtn: (amount: string, token: string) => `โอน ${amount} ${token} →`,

    // Dashboard
    dashTitle: 'Dashboard',
    dashSubtitle: 'ติดตามการรับ crypto ของคุณ',
    connectPrompt: 'Connect wallet เพื่อดู dashboard',
    statsLinks: 'Links ทั้งหมด',
    statsTx: 'TX ที่รับได้',
    statsWallet: 'Wallet',
    tabLinks: 'Transfer Links',
    tabTx: 'TX ที่รับ',
    emptyLinks: 'ยังไม่มี transfer link',
    emptyLinksBtn: 'สร้าง Transfer Link แรก',
    noAmount: (token: string) => `${token} (ไม่ระบุจำนวน)`,
    btnCopy: 'Copy',
    btnCopied: '✓',
    btnOpen: 'Open ↗',
    btnDelete: 'ลบ',
    txLoading: 'กำลังโหลด transaction history...',
    emptyTx: 'ยังไม่มี incoming transactions',
    emptyTxDesc: 'transactions จาก Base Sepolia จะแสดงที่นี่',
    totalReceived: 'Total ETH received',
    txFrom: (from: string, date: string) => `จาก ${from} • ${date}`,
    txTo: (to: string, date: string) => `ถึง ${to} • ${date}`,

    // WrongNetworkBanner
    wrongNetwork: 'กรุณาเปลี่ยน network เป็น Base Sepolia',
    switchNetwork: 'Switch Network',
    switching: 'กำลังเปลี่ยน...',

    // QRDisplay
    copyLink: 'Copy',
    copiedLink: 'Copied!',
    createToShare: 'กดสร้างลิงก์เพื่อแชร์',

    // Landing Page
    heroTitle: 'โอน crypto ง่ายเหมือน PromptPay', // already transfer-oriented
    heroSubtitle: 'สร้าง link รับเงิน crypto ง่ายๆ — แชร์ให้ใครก็ได้ โอนข้าม wallet ได้ทันที',
    heroCta: 'สร้าง Payo Link',
    howItWorksTitle: 'วิธีใช้งาน',
    step1Title: 'สร้าง Link',
    step1Desc: 'ระบุ wallet address, token, จำนวนเงิน แล้วสร้าง transfer link',
    step2Title: 'แชร์ Link',
    step2Desc: 'ส่ง link หรือ QR code ให้ผู้โอนผ่าน chat หรือ social media',
    step3Title: 'รับเงิน',
    step3Desc: 'ผู้ส่งกดโอนผ่าน link — เงินเข้า wallet คุณโดยตรง',
    valuePropsTitle: 'ทำไมต้อง Payo?',
    valueProp1: 'Trustless — ไม่ต้องเชื่อใจตัวกลาง เงินโอนตรงถึง wallet',
    valueProp2: 'Low Cost — ค่า gas ต่ำบน Base network',
    valueProp3: 'Cross-Wallet — ใช้ได้กับทุก wallet ที่รองรับ EVM',

    // Success Page Actions
    successCreateNew: 'สร้าง Transfer Link ใหม่',
    successGoHome: 'กลับหน้าหลัก',
    successShare: 'แชร์ Receipt',
    successTxHash: 'TX Hash',
    successRecipient: 'ผู้รับ',
    successShareText: (amount: string, token: string, hash: string) => `ฉันโอน ${amount} ${token} สำเร็จแล้ว! TX: ${hash}`,

    // Dashboard ERC-20
    totalReceivedToken: (token: string) => `Total ${token} received`,

    // Navbar
    navHome: 'หน้าหลัก',
    navFees: 'ค่าธรรมเนียม',
    navContact: 'ติดต่อเรา',

    // Blocked Screen
    tamperedTitle: 'ลิงก์นี้ถูกดัดแปลง',
    tamperedDesc: 'ไม่สามารถโอนผ่านลิงก์นี้ได้เนื่องจากข้อมูลอาจถูกเปลี่ยนแปลง กรุณาขอ link ใหม่จากผู้รับเงิน',
    tamperedGoHome: 'กลับหน้าหลัก',
    tamperedRequestNew: 'กรุณาขอ link ใหม่จากผู้รับเงิน',

    // Fee Dashboard
    feeDashTitle: 'ค่าธรรมเนียม',
    feeDashSubtitle: (address: string) => `ภาพรวมค่าธรรมเนียมของ ${address}`,
    feeTotalCollected: (token: string) => `รวม ${token} ที่เก็บได้`,
    feeBearingTx: 'ธุรกรรมที่มีค่าธรรมเนียม',
    feeFrom: (from: string, date: string) => `จาก ${from} • ${date}`,
    feeNoTx: 'ยังไม่มีธุรกรรมค่าธรรมเนียม',
    feeNoTxDesc: 'ธุรกรรมค่าธรรมเนียมจะแสดงที่นี่เมื่อมีการโอน',
    feeLoadError: 'ไม่สามารถโหลดข้อมูลค่าธรรมเนียมได้',
    feeRetry: 'ลองใหม่',

    // Company Dashboard & Fee Access Control
    companyDashTitle: 'Company Dashboard',
    companyDashSubtitle: 'ติดตามข้อมูลของบริษัท',
    navCompanyDashboard: 'Company Dashboard',
    feeAccessDenied: 'ไม่มีสิทธิ์เข้าถึง',
    feeAccessDeniedDesc: 'หน้านี้สำหรับ Company Wallet เท่านั้น',
    feeConnectWallet: 'กรุณาเชื่อมต่อ Company Wallet',
    feeConnectWalletDesc: 'เชื่อมต่อ wallet เพื่อดูข้อมูลค่าธรรมเนียม',

    // Chain Selector
    labelChain: 'Network',
    selectChain: 'เลือก Network',
    testnetBadge: 'Testnet',
    errorUnsupportedChain: 'ไม่รองรับ chain นี้',
    errorTokenNotOnChain: 'Token นี้ไม่รองรับบน chain ที่เลือก',

    // UX Polish
    copyAddress: 'Copy address',
    viewOnExplorer: 'ดูบน Explorer',
    gasForErc20: 'การโอน ERC-20 token ต้องใช้ ETH เล็กน้อยสำหรับค่า gas',

    // UX Improvements
    addressValid: 'Address ถูกต้อง',
    addressInvalid: 'Address ไม่ถูกต้อง',
    addressChecksumWarning: 'Checksum ไม่ถูกต้อง — ตรวจสอบ address อีกครั้ง',
    showFeeBreakdown: '▾ ดูรายละเอียดการบริจาค',
    hideFeeBreakdown: '▴ ซ่อนรายละเอียด',
    openInWallet: 'เปิดใน Wallet',
    confirmedAt: 'เวลาโอน',
    shareQR: 'แชร์ QR',
    waitingForConfirmation: 'รอ confirmation...',
    confirmationProgress: 'กำลังตรวจสอบ transaction บน blockchain',
    pollTimeout: 'ยังไม่ได้รับ confirmation — ตรวจสอบบน block explorer',
    checkOnExplorer: 'ตรวจสอบบน Explorer',

    // Payo Rebrand — new keys
    demoBtn: 'ดู Demo →',
    socialProof: (count: number) => `สร้าง transfer link ไปแล้ว ${count} รายการ`,
    securedByBase: '🔒 Secured by Base — funds sent directly to recipient',
    footerTerms: 'ข้อกำหนด',
    footerPrivacy: 'Privacy',

    // Demo Flow
    demoModeLabel: 'Demo Mode',
    demoBanner: '🧪 Demo Mode — ไม่มีการเรียก wallet หรือ blockchain จริง',
    demoStepCreate: 'สร้าง QR',
    demoStepPay: 'โอน',
    demoStepSuccess: 'สำเร็จ',
    demoCreateTitle: 'สร้าง Transfer Link (Demo)',
    demoCreateDesc: 'ตัวอย่างการสร้าง transfer link — ข้อมูลด้านล่างเป็นข้อมูลจำลอง',
    demoCreateBtn: 'สร้าง Payo Link →',
    demoPayTitle: 'โอน (Demo)',
    demoSendBtn: 'Send 0.01 ETH →',
    demoSending: '⏳ กำลังจำลองการโอน...',
    demoSuccessTitle: 'โอนสำเร็จ! 🎉',
    demoSuccessDesc: '0.01 ETH ถึงมือผู้รับแล้ว (จำลอง)',
    demoTryReal: 'สร้าง Transfer Link จริง →',
    demoGoHome: 'กลับหน้าแรก',
    demoTxHash: 'TX Hash (จำลอง)',

    // Social Share Buttons
    shareViaLine: 'LINE',
    shareViaWhatsApp: 'WhatsApp',
    shareViaTelegram: 'Telegram',
    shareMessage: (url: string) => `โอนผ่าน Payo: ${url}`,
    shareMessageText: 'โอนผ่าน Payo',

    // Consolidated USD Card
    consolidatedUsdReceived: 'ยอดรวม USD ที่ได้รับ',
    consolidatedUsdSent: 'ยอดรวม USD ที่ส่ง',
    consolidatedPartialNote: (tokens: string) => `ไม่รวม ${tokens} (ไม่มีราคา)`,

    // Single-use Link (Invoice Mode)
    labelSingleUse: 'ใช้ครั้งเดียว (Invoice)',
    singleUseHint: 'ลิงก์จะ deactivate อัตโนมัติหลังโอนครั้งแรก',
    linkUsedTitle: 'ลิงก์นี้ถูกใช้แล้ว',
    linkUsedDesc: 'Transfer link นี้ถูกใช้โอนแล้ว ไม่สามารถใช้ซ้ำได้',
    badgeInvoice: 'ใบแจ้งหนี้',
    badgePaid: 'จ่ายแล้ว ✓',

    // Profile Page
    profileTitle: 'โปรไฟล์',
    profileNoLinks: 'ไม่มีลิงก์โอนที่ใช้งานอยู่',
    profilePayButton: 'จ่าย',
    profileNotFound: 'ไม่พบโปรไฟล์',
    profileAnyAmount: 'จำนวนใดก็ได้',
    profileActiveLinks: (count: number) => `${count} ลิงก์ชำระเงินที่ใช้งานอยู่`,
    profileUsername: 'ชื่อผู้ใช้',

    // Payment Receipt
    receiptDownload: 'ดาวน์โหลด Receipt',
    receiptGenerating: 'กำลังสร้าง...',
    receiptError: 'ไม่สามารถสร้าง receipt ได้',
    receiptTitle: 'ใบเสร็จการโอน',
    receiptPayer: 'ผู้ส่ง',
    receiptRecipient: 'ผู้รับเงิน',
    receiptToken: 'Token',
    receiptAmount: 'จำนวน',
    receiptChain: 'Network',
    receiptTxHash: 'TX Hash',
    receiptMemo: 'หมายเหตุ',
    receiptConfirmedAt: 'เวลาที่ยืนยัน',
    receiptFeeTotal: 'ยอดรวมที่ส่ง',
    receiptFeeAmount: 'การบริจาค',
    receiptFeeRate: 'อัตราการบริจาค',
    receiptFeeNet: 'ผู้รับได้รับ',
    receiptFooter: 'สร้างโดย Payo',

    // Disclaimer
    disclaimerTitle: 'ข้อความปฏิเสธความรับผิดชอบ',
    disclaimerSection1Title: 'เครื่องมือทางเทคนิคเท่านั้น',
    disclaimerSection1Body: 'Payo เป็น UI โอเพนซอร์สแบบ non-custodial ที่ทำงานร่วมกับ smart contract แบบกระจายศูนย์ ไม่ใช่สถาบันการเงิน ตลาดแลกเปลี่ยน นายหน้า หรือผู้ประมวลผลการชำระเงิน',
    disclaimerSection2Title: 'ไม่มีการดูแลเงิน',
    disclaimerSection2Body: 'Payo ไม่เคยถือ private key หรือสินทรัพย์ใดๆ ธุรกรรมทั้งหมดเป็นแบบ peer-to-peer และดำเนินการโดยตรงบน blockchain',
    disclaimerSection3Title: 'ความรับผิดชอบของผู้ใช้',
    disclaimerSection3Body: 'ผู้ใช้รับผิดชอบแต่เพียงผู้เดียวในการปฏิบัติตามกฎหมายท้องถิ่น ในประเทศไทย การใช้สินทรัพย์ดิจิทัลเป็นสื่อกลางในการชำระเงินสำหรับสินค้า/บริการอยู่ภายใต้การกำกับดูแล Payo มีไว้สำหรับการโอนส่วนตัว การให้ทิป และการบริจาคเท่านั้น',
    disclaimerSection4Title: 'ความเสี่ยงสูงและไม่รับผิดชอบ',
    disclaimerSection4Body: 'ซอฟต์แวร์นี้ให้บริการ "ตามสภาพ" โดยไม่มีการรับประกันใดๆ Payo ไม่รับผิดชอบต่อเงินที่สูญหาย ธุรกรรมที่ล้มเหลว หรือความล้มเหลวของ smart contract',
    disclaimerAcceptLabel: 'ฉันได้อ่านและยอมรับข้อความปฏิเสธความรับผิดชอบข้างต้น',

    // Badges
    nonCustodialBadge: '100% Non-Custodial & Trustless',
    openSourceBadge: 'โอเพนซอร์ส',

    // Donation
    donationLabel: 'บริจาคเพื่อสนับสนุนการพัฒนา (ไม่บังคับ)',
    donationZeroOk: 'ตั้งค่าเป็น 0 เพื่อข้ามได้',

    // Terms of Service
    termsNatureTitle: 'ลักษณะของซอฟต์แวร์',
    termsNatureBody: 'Payo ทำหน้าที่เป็นเครื่องมือสร้างข้อมูลธุรกรรมเท่านั้น ไม่ได้อำนวยความสะดวก ตรวจสอบ หรืออนุมัติธุรกรรม',
    termsProhibitedTitle: 'การใช้งานที่ต้องห้าม',
    termsProhibitedBody: 'การประมวลผลการชำระเงินเชิงพาณิชย์โดยไม่มีใบอนุญาต การฟอกเงิน และการหลีกเลี่ยงกฎระเบียบทางการเงินเป็นสิ่งต้องห้ามอย่างเคร่งครัด',
    termsThirdPartyTitle: 'โปรโตคอลของบุคคลที่สาม',
    termsThirdPartyBody: 'ผู้ใช้โต้ตอบกับเครือข่ายของบุคคลที่สาม (Base, Optimism, Arbitrum) Payo ไม่มีการควบคุมเครือข่ายเหล่านี้และไม่รับผิดชอบต่อพฤติกรรมของเครือข่าย',
    termsModificationTitle: 'การแก้ไขและการยุติ',
    termsModificationBody: 'Payo ขอสงวนสิทธิ์ในการแก้ไขหรือยุติการให้บริการอินเทอร์เฟซได้ตลอดเวลาโดยไม่ต้องแจ้งให้ทราบล่วงหน้า',
  },

  en: {
    // Navbar
    brand: 'Payo',
    navDashboard: 'Dashboard',
    navCreateLink: 'Create Link',

    // Create page
    createTitle: 'Create Transfer Link',
    createSubtitle: 'Like PromptPay but for Crypto — share a transfer link and receive funds instantly',
    labelAddress: 'Recipient Wallet Address',
    addressPlaceholder: '0x...',
    useMyWallet: 'Use Mine',
    labelToken: 'Token',
    labelAmount: 'Amount (leave blank to let payer decide)',
    amountPlaceholder: '0.00',
    labelMemo: 'Note (optional)',
    memoPlaceholder: 'e.g. Birthday gift, coffee, donation',
    createButton: 'Create Transfer Link',
    saveButton: 'Save Link ✓',
    linkReady: 'QR Ready to Share! 🎉',
    viewDashboard: 'View all links in Dashboard →',
    labelExpiry: 'Link Expiration',
    expiryNone: 'No expiry',
    expiry1d: '1 day',
    expiry7d: '7 days',
    expiry30d: '30 days',
    expiresOn: (date: string) => `Expires ${date}`,

    // Pay page
    invalidLink: 'Invalid Transfer Link',
    invalidLinkDesc: 'This link may have expired or is corrupted',
    expiredLink: 'Transfer Link Expired',
    expiredLinkDesc: (date: string) => `This transfer link expired on ${date}`,
    labelBalance: 'Your Balance',
    insufficientBalance: 'Insufficient balance',
    paySuccess: 'Transfer Successful! 🎉',
    paySuccessDesc: (amount: string, token: string) => `${amount} ${token} has been sent to the recipient`,
    viewOnBasescan: 'View Transaction on Basescan ↗',
    payTitle: (amount: string, token: string) => `Send ${amount} ${token}`,
    payTitleNoAmount: (token: string) => `Send ${token}`,
    labelRecipient: 'Recipient',
    labelTokenField: 'Token',
    labelNetwork: 'Network',
    networkName: 'Base Sepolia (Testnet)',
    labelCustomAmount: 'Amount to Send',
    errorRejected: 'Transaction rejected',
    errorInsufficientFunds: 'Insufficient funds for gas',
    errorNetwork: 'Network error, please try again',
    errorGeneric: 'Something went wrong, please try again',
    retryBtn: 'Try Again',
    retryCount: (n: number) => `Attempted ${n} time${n > 1 ? 's' : ''}`,
    connectToPayBtn: 'Connect to Send',
    waitingWallet: '⏳ Waiting for wallet approval...',
    waitingConfirm: '⏳ Waiting for confirmation...',
    payBtn: (amount: string, token: string) => `Send ${amount} ${token} →`,

    // Dashboard
    dashTitle: 'Dashboard',
    dashSubtitle: 'Track your incoming crypto transfers',
    connectPrompt: 'Connect your wallet to view dashboard',
    statsLinks: 'Total Links',
    statsTx: 'TX Received',
    statsWallet: 'Wallet',
    tabLinks: 'Transfer Links',
    tabTx: 'TX Received',
    emptyLinks: 'No transfer links yet',
    emptyLinksBtn: 'Create Your First Transfer Link',
    noAmount: (token: string) => `${token} (any amount)`,
    btnCopy: 'Copy',
    btnCopied: '✓',
    btnOpen: 'Open ↗',
    btnDelete: 'Delete',
    txLoading: 'Loading transaction history...',
    emptyTx: 'No incoming transactions yet',
    emptyTxDesc: 'Transactions from Base Sepolia will appear here',
    totalReceived: 'Total ETH received',
    txFrom: (from: string, date: string) => `From ${from} • ${date}`,
    txTo: (to: string, date: string) => `To ${to} • ${date}`,

    // WrongNetworkBanner
    wrongNetwork: 'Please switch network to Base Sepolia',
    switchNetwork: 'Switch Network',
    switching: 'Switching...',

    // QRDisplay
    copyLink: 'Copy',
    copiedLink: 'Copied!',
    createToShare: 'Create link to share',

    // Landing Page
    heroTitle: 'Crypto transfers, as easy as a link.',
    heroSubtitle: 'Create a transfer link to receive crypto — share with anyone, instant cross-wallet transfers',
    heroCta: 'Create Payo Link',
    howItWorksTitle: 'How It Works',
    step1Title: 'Create a Link',
    step1Desc: 'Enter your wallet address, choose a token and amount, then generate a transfer link',
    step2Title: 'Share the Link',
    step2Desc: 'Send the link or QR code to the payer via chat or social media',
    step3Title: 'Receive Funds',
    step3Desc: 'The sender clicks the link and transfers — funds go directly to your wallet',
    valuePropsTitle: 'Why Payo?',
    valueProp1: 'Trustless — No middleman, funds go straight to your wallet',
    valueProp2: 'Low Cost — Minimal gas fees on Base network',
    valueProp3: 'Cross-Wallet — Works with any EVM-compatible wallet',

    // Success Page Actions
    successCreateNew: 'Create New Transfer Link',
    successGoHome: 'Go Home',
    successShare: 'Share Receipt',
    successTxHash: 'TX Hash',
    successRecipient: 'Recipient',
    successShareText: (amount: string, token: string, hash: string) => `I just sent ${amount} ${token} successfully! TX: ${hash}`,

    // Dashboard ERC-20
    totalReceivedToken: (token: string) => `Total ${token} received`,

    // Navbar
    navHome: 'Home',
    navFees: 'Fees',
    navContact: 'Contact',

    // Blocked Screen
    tamperedTitle: 'This link has been tampered with',
    tamperedDesc: 'This transfer cannot be processed through this link because the data may have been altered. Please request a new link from the recipient.',
    tamperedGoHome: 'Go to Homepage',
    tamperedRequestNew: 'Please request a new link from the recipient',

    // Fee Dashboard
    feeDashTitle: 'Fee Dashboard',
    feeDashSubtitle: (address: string) => `Platform fee collection overview for ${address}`,
    feeTotalCollected: (token: string) => `Total ${token} fees collected`,
    feeBearingTx: 'Fee-bearing transactions',
    feeFrom: (from: string, date: string) => `From ${from} • ${date}`,
    feeNoTx: 'No fee transactions yet',
    feeNoTxDesc: 'Fee transactions will appear here once transfers are processed',
    feeLoadError: 'Failed to load fee data',
    feeRetry: 'Retry',

    // Company Dashboard & Fee Access Control
    companyDashTitle: 'Company Dashboard',
    companyDashSubtitle: 'Track company data',
    navCompanyDashboard: 'Company Dashboard',
    feeAccessDenied: 'Access Denied',
    feeAccessDeniedDesc: 'This page is for Company Wallet only',
    feeConnectWallet: 'Please connect Company Wallet',
    feeConnectWalletDesc: 'Connect your wallet to view fee data',

    // Chain Selector
    labelChain: 'Network',
    selectChain: 'Select Network',
    testnetBadge: 'Testnet',
    errorUnsupportedChain: 'Unsupported chain',
    errorTokenNotOnChain: 'Token not supported on this chain',

    // UX Polish
    copyAddress: 'Copy address',
    viewOnExplorer: 'View on Explorer',
    gasForErc20: 'Sending ERC-20 tokens requires a small amount of ETH for gas fees',

    // UX Improvements
    addressValid: 'Valid address',
    addressInvalid: 'Invalid address',
    addressChecksumWarning: 'Invalid checksum — please verify the address',
    showFeeBreakdown: '▾ Show donation details',
    hideFeeBreakdown: '▴ Hide details',
    openInWallet: 'Open in Wallet',
    confirmedAt: 'Confirmed at',
    shareQR: 'Share QR',
    waitingForConfirmation: 'Waiting for confirmation...',
    confirmationProgress: 'Checking transaction on blockchain',
    pollTimeout: 'Confirmation not received — check on block explorer',
    checkOnExplorer: 'Check on Explorer',

    // Payo Rebrand — new keys
    demoBtn: 'View Demo →',
    socialProof: (count: number) => `${count} transfer links created`,
    securedByBase: '🔒 Secured by Base — funds sent directly to recipient',
    footerTerms: 'Terms',
    footerPrivacy: 'Privacy',

    // Demo Flow
    demoModeLabel: 'Demo Mode',
    demoBanner: '🧪 Demo Mode — No real wallet or blockchain calls',
    demoStepCreate: 'Create QR',
    demoStepPay: 'Send',
    demoStepSuccess: 'Success',
    demoCreateTitle: 'Create Transfer Link (Demo)',
    demoCreateDesc: 'Example transfer link creation — data below is simulated',
    demoCreateBtn: 'Create Payo Link →',
    demoPayTitle: 'Send (Demo)',
    demoSendBtn: 'Send 0.01 ETH →',
    demoSending: '⏳ Simulating transfer...',
    demoSuccessTitle: 'Transfer Successful! 🎉',
    demoSuccessDesc: '0.01 ETH has been sent to the recipient (simulated)',
    demoTryReal: 'Create a Real Transfer Link →',
    demoGoHome: 'Go Home',
    demoTxHash: 'TX Hash (simulated)',

    // Social Share Buttons
    shareViaLine: 'LINE',
    shareViaWhatsApp: 'WhatsApp',
    shareViaTelegram: 'Telegram',
    shareMessage: (url: string) => `Send via Payo: ${url}`,
    shareMessageText: 'Send via Payo',

    // Consolidated USD Card
    consolidatedUsdReceived: 'Total USD Received',
    consolidatedUsdSent: 'Total USD Sent',
    consolidatedPartialNote: (tokens: string) => `Excludes ${tokens} (price unavailable)`,

    // Single-use Link (Invoice Mode)
    labelSingleUse: 'Single-use (Invoice)',
    singleUseHint: 'Link will auto-deactivate after first transfer',
    linkUsedTitle: 'This link has been used',
    linkUsedDesc: 'This transfer link has already been used and cannot accept further transfers.',
    badgeInvoice: 'Invoice',
    badgePaid: 'Paid ✓',

    // Profile Page
    profileTitle: 'Profile',
    profileNoLinks: 'No active transfer links',
    profilePayButton: 'Pay',
    profileNotFound: 'Profile not found',
    profileAnyAmount: 'Any amount',
    profileActiveLinks: (count: number) => `${count} active transfer link${count !== 1 ? 's' : ''}`,
    profileUsername: 'Username',

    // Payment Receipt
    receiptDownload: 'Download Receipt',
    receiptGenerating: 'Generating...',
    receiptError: 'Failed to generate receipt',
    receiptTitle: 'Transfer Receipt',
    receiptPayer: 'Sender',
    receiptRecipient: 'Recipient',
    receiptToken: 'Token',
    receiptAmount: 'Amount',
    receiptChain: 'Network',
    receiptTxHash: 'TX Hash',
    receiptMemo: 'Note',
    receiptConfirmedAt: 'Confirmed at',
    receiptFeeTotal: 'Total sent',
    receiptFeeAmount: 'Donation',
    receiptFeeRate: 'Donation rate',
    receiptFeeNet: 'Recipient receives',
    receiptFooter: 'Generated by Payo',

    // Disclaimer
    disclaimerTitle: 'Important Disclaimer',
    disclaimerSection1Title: 'Technical Interface Only',
    disclaimerSection1Body: 'Payo is a non-custodial, open-source UI that interacts with decentralized smart contracts. It is NOT a financial institution, exchange, broker, or payment processor.',
    disclaimerSection2Title: 'No Custody of Funds',
    disclaimerSection2Body: 'Payo never holds private keys or assets. All transactions are peer-to-peer and executed directly on-chain.',
    disclaimerSection3Title: 'User Responsibility & Compliance',
    disclaimerSection3Body: 'Users are solely responsible for complying with local laws. In Thailand, using digital assets as Means of Payment for goods/services is regulated. Payo is intended for personal P2P transfers, social tipping, and donations only.',
    disclaimerSection4Title: 'High Risk & No Liability',
    disclaimerSection4Body: 'This software is provided "AS IS" with no warranties. Payo is not liable for lost funds, failed transactions, or smart contract failures.',
    disclaimerAcceptLabel: 'I have read and agree to the above disclaimer',

    // Badges
    nonCustodialBadge: '100% Non-Custodial & Trustless',
    openSourceBadge: 'Open Source',

    // Donation
    donationLabel: 'Optional donation to support development',
    donationZeroOk: 'You can set this to 0 to skip',

    // Terms of Service
    termsNatureTitle: 'Nature of Software',
    termsNatureBody: 'Payo acts solely as a visual tool to generate transaction data. It does not facilitate, verify, or authorize transactions.',
    termsProhibitedTitle: 'Prohibited Use Cases',
    termsProhibitedBody: 'Commercial payment processing without applicable permits, money laundering, and circumventing financial regulations are strictly prohibited.',
    termsThirdPartyTitle: 'Third-Party Protocols',
    termsThirdPartyBody: 'Users interact with third-party networks (Base, Optimism, Arbitrum). Payo has no control over these networks and is not responsible for their behavior.',
    termsModificationTitle: 'Modification & Termination',
    termsModificationBody: 'Payo reserves the right to modify or discontinue the interface at any time without notice.',
  },
}

export type Lang = keyof typeof translations
export type Translations = typeof translations.th
