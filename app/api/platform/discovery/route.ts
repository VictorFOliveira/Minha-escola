import { NextResponse } from "next/server";
import { CACTUS_PRODUCT_CODE,CACTUS_PRODUCT_NAME,cactusEnvironment,pairingState } from "@/lib/cactus-pairing";

export const dynamic="force-dynamic";

export async function GET(){
  const paired=await pairingState();
  return NextResponse.json({
    ok:true,
    service:"cactus-saas",
    productCode:CACTUS_PRODUCT_CODE,
    productName:CACTUS_PRODUCT_NAME,
    environment:cactusEnvironment(),
    adminApiPath:"/api/platform",
    apiVersion:1,
    paired:Boolean(paired?.active),
  },{headers:{"Cache-Control":"no-store"}});
}
