import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export const CACTUS_PRODUCT_CODE="MINHA_ESCOLA";
export const CACTUS_PRODUCT_NAME="Minha Escola";
export const cactusEnvironment=()=>String(process.env.CACTUS_SAAS_ENV||"local").trim().toLowerCase();

export function safeEqual(a:string,b:string){
  const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));
  return x.length>0&&x.length===y.length&&crypto.timingSafeEqual(x,y);
}
export const platformHash=(value:string)=>crypto.createHash("sha256").update(value).digest("hex");

export async function pairingState(){
  return prisma.platformControlPlaneCredential.findUnique({where:{id:1}});
}

export async function savePairing(platformKey:string,rotate:boolean){
  return prisma.platformControlPlaneCredential.upsert({
    where:{id:1},
    create:{id:1,keyHash:platformHash(platformKey),active:true,rotatedAt:rotate?new Date():null},
    update:{keyHash:platformHash(platformKey),active:true,rotatedAt:rotate?new Date():undefined},
  });
}
