import { NextResponse } from "next/server";
import { CACTUS_PRODUCT_CODE,CACTUS_PRODUCT_NAME,cactusEnvironment,pairingState,safeEqual,savePairing } from "@/lib/cactus-pairing";

export async function POST(request:Request){
  const expected=String(process.env.CACTUS_PAIRING_KEY||"");
  const supplied=String(request.headers.get("x-cactus-pairing-key")||"");
  if(expected.length<32||!safeEqual(supplied,expected))return new NextResponse(null,{status:404});

  const body=await request.json().catch(()=>null) as any;
  if(!body||body.controlPlane!=="cactus-superadmin"||String(body.expectedProductCode||"").toUpperCase()!==CACTUS_PRODUCT_CODE)
    return NextResponse.json({error:"pairing_identity_invalid"},{status:400});
  const environment=cactusEnvironment();
  if(String(body.expectedEnvironment||"").toLowerCase()!==environment)
    return NextResponse.json({error:"environment_mismatch",environment},{status:409});
  const platformKey=String(body.platformKey||"");
  if(platformKey.length<32)return NextResponse.json({error:"platform_key_invalid"},{status:400});

  const existing=await pairingState();
  const rotate=Boolean(body.rotate);
  if(existing?.active&&!rotate)return NextResponse.json({error:"already_paired"},{status:409});
  await savePairing(platformKey,rotate);

  return NextResponse.json({
    ok:true,service:"cactus-saas",productCode:CACTUS_PRODUCT_CODE,
    productName:CACTUS_PRODUCT_NAME,environment,apiVersion:1
  },{status:existing?200:201,headers:{"Cache-Control":"no-store"}});
}
