'use strict';
const {MicrosoftAuth}=require('./vendor/launcher/auth.cjs');
// Reuse the launcher's PKCE/state/loopback handling, ending at Company identity.
// No Minecraft sign-in, entitlement lookup, game mint or stored Microsoft refresh token.
class CompanyMicrosoft extends MicrosoftAuth{
 constructor({accounts,...options}){super(options);this.accounts=accounts;}
 async exchange(msa,oldRefresh,signal){
  const {xbox,refreshToken}=await this.xboxSignIn(msa,oldRefresh,signal);
  const graph=await this.graphAccessToken(refreshToken,signal);
  return this.accounts.login(xbox.Token,signal,undefined,graph?.accessToken);
 }
}
module.exports={CompanyMicrosoft};
