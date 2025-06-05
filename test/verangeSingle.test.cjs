const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const crs = {
  "Q": {
    "x": "0x1a7c2f4958df6d76cfac37a8e93c02861d2bda787ad173762ce9694ab836930",
    "y": "0xdf2115937eb46a39e80d4aa03e2f1ce1d6d700499be629c2cd27628eb6e816e"
  },
  "H": [
    {
      "x": "0xb8fe18fa4c7a1f2e5279112577b3b84c7ce6c47d0e98b839ecbcdc7c055bea3",
      "y": "0x1018d8f2134443d3d3124d348340a4fbda1dbbc336fb8d42c3487ce3f679819d"
    },
    {
      "x": "0x5c7744a37627859cdb981c93a07367a14b4dde74a1b1ca5eaeb17ffe4975804",
      "y": "0x9f0881ca160556a3a85580d41d6e5f2b3c6897abeaa2a6b1d62b004e14f6870"
    },
    {
      "x": "0x153ac75a87dd2fb723d8698a56b03790a65a6dbc33ad1c5fb5b49ee6437efe99",
      "y": "0x2d304f5a5f377940b7565882ccfa2f898a991084908dd3128cf1397ddbe7720"
    },
    {
      "x": "0x21191e9dca27fcc5c961d4146343a1a09964c2938ab35ca8f6f3bebec9710ff0",
      "y": "0x526fe913cdbdcd900f53930e52c6d549ec1dc254a63ab76da26bb3afe0436fe"
    },
    {
      "x": "0x2d5763b0d3a2b325e0265b3970b161241946f52e62326d6f3c34db4c36c1f8f8",
      "y": "0x143358a6db4f63ab8325cce016b0e64ea963d7c7f076c7c240d235d8bc2d3e48"
    },
    {
      "x": "0xcd5a90ff09f5396805da6659b175ece79afbfa878a5edbd0416b96b9bf157e5",
      "y": "0x3d1532a980a2f3a8ec873f9d9b730c4ec5dafe63e1b7ac3482381d334d8e7f2"
    },
    {
      "x": "0x2238356a6712aa591f3aaa5ddd33e42af7c418984b8538f63ed6387d9b52a3fc",
      "y": "0xd4be17b79909587f3de062a7f4f05d37fc6cffb3dd9680c7e1e7ba78f18026d"
    },
    {
      "x": "0x210df2442ca85ed45c12e8bfc02e6287e8a61cd42a57982ad8bd514f93c15877",
      "y": "0x373498499e04db742d4a086603dc31be9d1445ec433baed3f4772a8362c456"
    }
  ]
};

const proof = {
  "commitmentCmOmega": {
    "x": "0x2b781d3f104ede2ef4d6f08f7d8b59a28c329f19051180e8bd513e3097b2b2f4",
    "y": "0x191633a3cdbcbac891bc910e7c93c289056fd16dadb437b3e4a113d54af26004"
  },
  "R_point": {
    "x": "0x1eff73bf7c1d24e352da25df676a53554091504d9c7025025d4450b28d5c9d83",
    "y": "0x2553acce34f5ee123ea58bd894221fd4122e6b3dd57f582e78ecb5cd91b1a20e"
  },
  "S_point": {
    "x": "0x0",
    "y": "0x0"
  },
  "W_points": [
    {
      "x": "0x11404f0a6f277bf97e634b6443b08c959b9e8c253f0910b5332b435fe019715b",
      "y": "0x30621ed7f9c553d23815bbc6b9d1c6dbbfd8e1f6f8f780d36d92b690bff8dc3"
    },
    {
      "x": "0x21213b9f2a1a6662d737e23437d6c84a2c7bb2257f9304cdaf596b795d39e706",
      "y": "0x2aea7bd37d16559554d137feaab5cde5d3e78051d13cfa90d4d75f5bcff2b4b8"
    },
    {
      "x": "0x1725789f7438b717f6359df919f44be30651165aee2ea78575c3063c20d862d8",
      "y": "0x2181e477edaffa43bf138bd3b19f639a5598c7509164bdc97d0413832550b48b"
    },
    {
      "x": "0x2facc1a73cce6a28f9aa6e1023c31598e7cb4347e4ff714221703d9962fee106",
      "y": "0x16933046c6a588b45f2dd02ac2b95e1933eeadc339039c68d626f81bbb9c5842"
    },
    {
      "x": "0xe99d9532e8ff6b5d9eb8ebd4e4f507b3efc54653ec84b77d5a55fd4fe5ff150",
      "y": "0x11154465b59d4cb8192ef2e03a23ed572ab0b852a2468244e0a07caa38ffd9c1"
    },
    {
      "x": "0x26dfeddbe264b7741e5833b3a3c5892cc97a91406a79f2ae7f4c0803e2050594",
      "y": "0x5a70605f2d473f1406fee9baaa48ebfe50775f859912d950125754b977a830f"
    },
    {
      "x": "0x9cb838347feefec9e76b5cd9fbaf300fce0081de6bf15bd3a52c0db7728fe23",
      "y": "0xdf12f7be0beead5a3066b0dae791b44c12541fed1b5706f74127e4417ce18ff"
    },
    {
      "x": "0x7b2dc237fcedb1f9057bc3b9023051dd4809265264d42417f64f64a664af6aa",
      "y": "0x29765d8040d3ed63513ec2ee2a6f1a5333c23ee1d6c57414c81d98fb379a93f6"
    }
  ],
  "T_points": [
    {
      "x": "0x147cfe14c3659c6927beb09bbd5fab017e0626b72f4d03af7cc9511cbd348b19",
      "y": "0x16f0422de5f0963afcbbad8a12528b42c68b148d22c5a8eda614ba6e434cb83c"
    },
    {
      "x": "0x32a7e15ee1273144dc73eabee3038c5fa7f6de20bb35211b5c666204fbf34bb",
      "y": "0x17d8f209db52b27d303de8206fe2fa8e9cd9b562555457dc78fcec8f464f4181"
    },
    {
      "x": "0x964716a0d53156d080e5c1b7cc571b26b3ba075680af8071d45b807c5d73e5e",
      "y": "0x1a75d436f0eb6f1fc598f4ea66ed2ac8fa15040e3ff364112f5b24ff307ba0c9"
    },
    {
      "x": "0x1dc619e4d613a2c43c5bae0caf846f0f616b9738d9fc466c7a9a57d8a0d3a07",
      "y": "0x133f0b4da003f5e0aa3c7121ed748ff9a6c564c21ae49ff35c64ff8e4446dfb"
    },
    {
      "x": "0x52f1d4fc939afc4f10d3f44a35fc18aba87e620f148bc94be54e7a04a371b5d",
      "y": "0x79104ecc5129e46f32f25ed2cf305a091cfeb4cca2fe2af0ef8f0cb0770625a"
    },
    {
      "x": "0x123fec245c1e59afea1aee7aedc010b288ca419e750a370634f9c84a25cb90a0",
      "y": "0x8d60ab542047207e284ff71eb1dc79bdb890574b4cf17e42f2825bd48911a30"
    },
    {
      "x": "0x2cf8cce1a4a6a67271ec69b3abd166860a0ef124e084be60aee1b231732979a4",
      "y": "0x2b8e54706393c7b7181a3817a8ca1a53099ff8131157748a7791897afcac4a33"
    },
    {
      "x": "0x204539dffd2077f38d92c709e90bc1dea6020185c07a8d99ec4e0e042e35666c",
      "y": "0x1345867b854f12c3bcbf94a8c7b719c80b1d32681abb9232c683a2ae2b1ddba9"
    }
  ],
  "eta1": "0x284357dd147ae9a63a59fe63c134b66af33b7ef81906c83ad4f93e17725fead7",
  "eta2": "0xc85622c20b146ab893275760758f0dfbce049e94eb9cb5d820bd42a4a8f847e",
  "vMatrix": [
    "0x20d501dd5903927abc76c7e7e36b918767ae2cd257aa6490f1b75e0d516c1b33",
    "0x263a135dc03f676b7baf0b6ffa85cc36f9ad3e92ed7982d6ab0b7ee2292f60be",
    "0x2f48ba9c12b69d8aa76ffbdf86e854e275e472137558f02ee485f7e35d17d450",
    "0x6ade4a813ff70a44e2217648428e5ff49c305b9a3cd2bc3b9236b9e13dbd2ac",
    "0x2954155d07dc8d94a4df5d78e28a6d817cb0fe4afd789eca263d8677948045d4",
    "0x2b477a74d972f02bbfeb950f5a92cf69f25d2f8488922bf90c50e242ec5d1ff3",
    "0x1c69a3fc3516620de50e1b2281d6d59d4b093ab0bf0834ea312178a9984b245d",
    "0x47f404278173910df588ebadb8606c96a87ee8ad7b027c7e5e31eaaefdb3d85",
    "0x1677d15baf9e92cb3dc28ff51bfe00f45a2ba08de2915a680ffa6ca9533c3b67",
    "0x20b2cf894ef624f2bb36472ba47852a313251903d87fd0864c9e2e919543181e",
    "0x2ecf412b30e90cb7b3e29e44cdf6d3efe2081360ef5dfc85ac0219dee2edd79e",
    "0x13f6c7c2424f06e655782b5b1b59a821d668e2e3046b073be0e3271157bcfaac",
    "0x12137cec5a2f6a402be03639adaf926914182dd8ec7448fa9e624844f569c19d",
    "0x4e881f6a09f21140c0b582aff7b6f2091815834e7eac3ebe7a01c847585573f",
    "0x12711a084954bb77826becc089caa9b00201cc78592e409b6542cddc70bf91fe",
    "0x2b1fd893366becac8f2cd66761a31c414035753ab14cbe7e9fdb4c11eb344bde",
    "0x1e875a54a1949cd8689333c52d1c4715de076170f521f45d11c9a606e2d32d87",
    "0x2c4432ab75602b9b73a9a620b9f11ff5b3ae2b37a96aee24db336c22294101ba",
    "0x2de82845303a6ab7cb8de97efaaa47af96c4203a03c7974ed7db3ed86037af49",
    "0x690006fdc21179f72c150ea57db141f35fc299d24222675a0babd9b9908f686",
    "0x1ff810bec2ea5ae1076fb503c0e74b4855cffb3a62c30bf51f0b4b7830b9866a",
    "0x22db7787d8ebbd11f62c3c8e15285d5a1f980da369c00beff96312ba2ad06699",
    "0xea2775d8d9844ed96241ff630c852ce172ba6043384528dc7bf7d8b2fdd6ade",
    "0x2ab4fc3a4183cd21f914afab592f305d1d06aa74e34806f168cc4aba8876bb2f",
    "0x2b4bc36aac3cd9451d4e150b15cca60ea83c9e7ec32e9c3a142980940bb1ade3",
    "0x1009d82481f070ee2045174ee3565d8ab72d40eccc4c9ed609ea1492593a01a0",
    "0x69be1d45422eea4f3239a3e24f2b696bc9ccd82edabd0a547cc52b4bf736ec",
    "0x1bfbaf9d602c9b6d645ddd21d7220f5c6bb95221d04b8282974428e71fc064dc",
    "0x27aedccd2b4a58d293b1c8418d90e3768668c0b8121209ca312c641490953d27",
    "0x2213cbc8bef30afb211246ec65020340d052a25d38433c5f27217b329b8a60ea",
    "0x6c174ae46b4334b277058aecc32d6ded7c60dbca16ded0d3af4001f5d8a835f",
    "0x132ad2b26b0def8057feb153e3d50e88eb3357ac673ecf299129d483f60775de",
    "0x27f1e7ef5fb9145e034cb81975d523cc50c9952020358624ebcfe1b9ad6889de",
    "0x2fd5a36c79a598fbaa60f373433c5457ef625d249e72fac8ad2f2e2e695fb2cc",
    "0x1bef3d8e35eabe0c252771038a97f89dd5d9f42616e00cb86f0ecc9730b7e42c",
    "0x2d1d17e43df2e9122d11b9be78130187bd069dbdb8e4389e323b07d8d9c6456a",
    "0x114dcf9533f6e37efaa28c77a33a35db069707fc9d0b7a10a6c36ccfc4ca5d13",
    "0x2eac2f66a9e4ae286ab674876fe2edbb1e0289630d1d07de21173d4472dfb103",
    "0x249b0c71de09c5c807c55d6751acede1e5b39b6c02a4053e16503c1975f3786e",
    "0x21b140f984c06ee06bb4730e5671d0b2e77f1aef7dd00d8a7725f9d4b7eaedb1",
    "0x170f276f4a4eb66397cafafe5c1c2c64b3d0ea3f4f216e7eb7818397050ee52",
    "0x284c0cd13292f644c861d3ae76c2c22df7dbec52d0dba3c193b366d0e5b79258",
    "0x5358af59adde5767c76edc8d864ebb8b63a5051b08fd1d074909a95188bcde6",
    "0x2a3387f8b62cee125ef8099c9e23b4f804c24c04beceb15bab98c53a6edbb423",
    "0x12365a1c037884ac49e510ea58ff2e246ebf706271daea166da5f182098ee067",
    "0x2de43e296f9eb484267db917fe49b48d45e01813e34d8b7d164c6d61df676ae5",
    "0x360101d6383dd7edfeee26adfb243f217df9611c77fc431caa0cc6f30a827f2",
    "0x8abd2cc1a9d63c21afc1abb28f7d46ff895c15fb97fd2ef417900aa15b68ed5",
    "0x46028628c37a78be5ebf478629fab398a3f12260d46bf13a30a62243ac74610",
    "0x1e59a28b5e4e16a7705e54f03e84e8536f07a2f4e5cb31ba6e00e77297a62d68",
    "0x6730805f79d9b11e1f563f1b3a7475c3e8cda6edb7fb623d9ba8b5e246cff0a",
    "0x23e7906cff88b9f533e770fe0f9d5af0078b9fa2b80f0b144e27fda58e3b6142",
    "0x2b9be1dfc888020ce9e1af0b37ae1ab0503cbc66e1c05798c37c14fa9fee6207",
    "0xaa6b36991d742f31199b2d91eb4f4cccacb568acf2d8a59602572ae3384ae7c",
    "0x14cd910d7f70dcdcbb81c8f7a30096bff5f7cb4b005967b2a2cb84c49b6e1aa2",
    "0x236c9bc4798c652c4672fc98130a89bb0cf282c01977a517252ea77b703144da",
    "0x139eea0f71dc66968eb2d4f65a80ea7fc1f485d61d1fd9b62d7c52b58356ade0",
    "0x24ef9726243c973e80d1607aca18e56ca9409c648b1a90a076d881883219774",
    "0x288f0f9f0fa124dfee8ddf6aac13b3e7a8d77f2df5243a88285dc5122554a416",
    "0x17c32006a0e26448a150c0a4e0b963c7b471d6dc5c285719dbd8f29d039e655d",
    "0x129890bd7a6d4f2e945229e64817b8b7c8136f79b832b9f453a7d3cfb08508b5",
    "0x12cf06bed6f300e3587139f14f66718618f70502a375fb659896bcc8c70614bb",
    "0x829d09bd4f49c7955f589683bd5bc889748e3859596d2dfb5a1257b57145b64",
    "0x10d72e42cd9da07c183517e781cca3a4299401794c0c6ee130d2e6f4e8b83435"
  ]
};

const simpleTallyPath = path.join(__dirname, "..", "..", "contracts", "plugins", "SimpleTally.sol");
const simpleTallyBackupPath = simpleTallyPath + ".bak";

const simpleTallyContent = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./base/TallyBase.sol";

contract SimpleTally is TallyBase {
    constructor(string[] memory _candidates) TallyBase(_candidates) {}

    function tallyCommitment(
        address,
        uint256,
        uint256
    ) external pure {
        // Dummy implementation for compilation purposes
    }

    function getTally() external view returns (uint256[] memory) {
        uint256[] memory dummyTally = new uint256[](candidates.length);
        return dummyTally;
    }
}
`;

describe("VeRange — single proof", () => {
  let verifier;
  let proof;
  let crs;

  before(async () => {
    // Read CRS and Proof from files
    crs = JSON.parse(fs.readFileSync("scripts/crs.json", "utf8"));
    proof = JSON.parse(fs.readFileSync("scripts/example_proof.json", "utf8"));
    
    // Deploy the verifier with the CRS
    const H_points = crs.H.map(p => ({ x: p.x, y: p.y }));
    const VerifierFactory = await ethers.getContractFactory("VerangeVerifier");
    verifier = await VerifierFactory.deploy({ x: crs.Q.x, y: crs.Q.y }, H_points);
    await verifier.waitForDeployment();
  });

  // Helper to structure the proof for the contract call
  const formatProofForContract = (proof) => {
    const { commitmentCmOmega, W_points, T_points, R_point, S_point, ...proofRest } = proof;
    return {
      ...proofRest,
      W: W_points,
      T: T_points,
      R: R_point,
      S: S_point,
    };
  };

  it("accepts a valid proof generated by the script", async () => {
    const proofStruct = formatProofForContract(proof);
    const isValid = await verifier.verifyVeRange(proof.commitmentCmOmega, proofStruct);
    expect(isValid).to.be.true;
  });

  it("rejects a tampered proof (e.g., modified eta2)", async () => {
    const tamperedProof = { ...proof };
    tamperedProof.eta2 = '0x' + ('0'.repeat(63) + '1'); // Corrupt eta2
    
    const tamperedProofStruct = formatProofForContract(tamperedProof);
    const isValid = await verifier.verifyVeRange(tamperedProof.commitmentCmOmega, tamperedProofStruct);
    expect(isValid).to.be.false;
  });
}); 