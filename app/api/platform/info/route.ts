import { NextResponse } from "next/server";
import { CACTUS_PRODUCT_CODE,CACTUS_PRODUCT_NAME,cactusEnvironment,pairingState,platformHash,safeEqual } from "@/lib/cactus-pairing";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const supplied=String(request.headers.get("x-platform-key")||"");
  if(!supplied)return NextResponse.json({error:"platform_unauthorized"},{status:401});
  const current=await pairingState();
  if(!current?.active||!safeEqual(platformHash(supplied),current.keyHash))
    return NextResponse.json({error:"platform_unauthorized"},{status:401});
  return NextResponse.json({
    ok:true,service:"cactus-saas",productCode:CACTUS_PRODUCT_CODE,
    productName:CACTUS_PRODUCT_NAME,environment:cactusEnvironment(),apiVersion:1
  },{headers:{"Cache-Control":"no-store"}});
}
