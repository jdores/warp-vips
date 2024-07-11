/**
 * This worker will make a mapping of device ids to virtual IPs
 * 
 * The worker can be triggered on demand when querying the worker hostname AND according to a cron schedule
 * 
 * Optional: if we want the output to be saved to R2 when the worker is triggered on demand, configure the wrangler.toml appropriately
 *     If STORE_R2 = true, the output will be saved to the bucket specified in the R2 bindings of wrangler.toml
 *     If STORE_R2 = false, the output will not be saved to an R2 bucket
 */
export default {
	// This function runs when we query the worker hostname
	async fetch(request, env, ctx) {
        return await handleRequest(request, env);
    },
	// This function runs according to the cron schedule
    async scheduled(event, env, ctx) {
        await handleRequest('notfetch',env);
    }
};
	
async function handleRequest(request, env) {

  // Inputs for Cloudflare API calls. Stored locally in .dev.var and in the edge in Workers secrets
  const accountId = env.ACCOUNT_ID;
  const userEmail = env.USER_EMAIL;
  const apiKey = env.API_KEY;

  // Optimization - if fetch, stop the worker if browser is requesting favicon.ico
  if (request != 'notfetch') {
	const urlRequest = new URL(request.url);
	const checkFavicon = urlRequest.pathname.slice(1);
	if(checkFavicon == "favicon.ico"){
		return new Response(null, { status: 204 });
	}
  }
  
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

  // STEP 02 - If Response is OK, we get the WARP virtual IP for each of the device ids
  // And we store the information fields we care about: device id, email of person associated, name of device, WARP virtual IP
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
		  vip: VirtualIps[0].device_ips.ipv4
		});
	  } else {
		deviceInfo.push({
		  id: device.id,
		  email: device.user.email,
		  name: device.name,
		  vip: 'Unknown'  // Handle case where details could not be fetched
		});
	  }
	}

	// Convert output to JSON format
	//const jsonOutput = JSON.stringify(deviceInfo);
	const jsonOutput = JSON.stringify(deviceInfo, null, 2);

	// STEP 03 - Store output in R2.
	// If fetch, it only runs if environmental variable STORE_R2 in wrangler.toml is set to true
	// If scheduled, runs everytime
	if(env.STORE_R2 || request == 'notfetch'){ 
		//const objectName = `warp_vips_${new Date().toISOString()}.json`;
		const objectName = env.R2_FILENAME;
		const uploadFile = new Blob([jsonOutput], { type: 'application/json' });
		await env.MY_BUCKET.put(objectName, uploadFile);
	}

	// STEP 04 - If fetch, Worker provides a response
	if (request != 'notfetch') {
		return new Response(jsonOutput, {
			headers: { 'Content-Type': 'application/json' }
		});
	}
  } else {
		// Fetch - if response from API is NOK
		if (request != 'notfetch') {
			return new Response(JSON.stringify({ error: data }), {
				status: response.status,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		// Scheduled - if response from API is NOK
		else{
			console.error(`Error fetching devices: ${JSON.stringify(data)}`);
		}
  }
}