/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx) {

	  // Inputs for Cloudflare API calls. Stored locally in .dev.var and in the edge in Workers secrets
	  const accountId = env.ACCOUNT_ID;
	  const userEmail = env.USER_EMAIL;
	  const apiKey = env.API_KEY;

	  // STEP 01 - Get devices
	  const devicesUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/devices`;
	  const response = await fetch(devicesUrl, {
        method: 'GET',
        headers: {
            'X-Auth-Email': userEmail,
			'X-Auth-Key': apiKey,
            'Content-Type': 'application/json'
        }
      });
	  const data = await response.json();

	  // STEP 02 - IF Response is OK, we get the WARP virtual IP for each of the device ids
	  // And we store the information fields we care about: device id, email of person associated, name of device, Virtual IP
	  if (response.ok) {
		const devices = data.result;
		const deviceInfo = [];
	
		for (let device of devices) {
		  let virtualIpUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/teamnet/devices/ips?device_ids[0]=${device.id}`;
		  let VirtualIpResponse = await fetch(virtualIpUrl, {
			method: 'GET',
			headers: {
				'X-Auth-Email': userEmail,
				'X-Auth-Key': apiKey,
				'Content-Type': 'application/json'
			}
		  });
	
		  let VirtualIpData = await VirtualIpResponse.json();
	
		  if (VirtualIpResponse.ok) {
			let VirtualIps = VirtualIpData.result;
	
			deviceInfo.push({
			  id: device.id,
			  email: device.user.email,
			  name: device.name,
			  version: VirtualIps[0].device_ips.ipv4
			});
		  } else {
			deviceInfo.push({
			  id: device.id,
			  email: device.user.email,
			  name: device.name,
			  version: 'Unknown'  // Handle case where details could not be fetched
			});
		  }
		}
	
		return new Response(JSON.stringify(deviceInfo), {
		  headers: { 'Content-Type': 'application/json' }
		});
	  } else {
		return new Response(JSON.stringify({ error: data }), {
		  status: response.status,
		  headers: { 'Content-Type': 'application/json' }
		});
	  }
	},
};