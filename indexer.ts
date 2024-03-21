import { Block } from "@near-lake/primitives";
/**
 * Note: We only support javascript at the moment. We will support Rust, Typescript in a further release.
 */

/**
 * getBlock(block, context) applies your custom logic to a Block on Near and commits the data to a database.
 * context is a global variable that contains helper methods.
 * context.db is a subfield which contains helper methods to interact with your database.
 *
 * Learn more about indexers here:  https://docs.near.org/concepts/advanced/indexers
 *
 * @param {block} Block - A Near Protocol Block
 */

async function getBlock(block: Block) {
  const BASE_ACCOUNT_ID = "potlock.near"; // potlock base id to match all actions
  
  // this function helps match factories, deployed in the manner `version.ptofactory....` where version can be v1,v2,vn
  function matchVersionPattern(text) {
    const pattern = /^v\d+\.potfactory\.potlock\.near$/;
    return pattern.test(text);
  }

  // filter receipts in this block to make sure we're inly indexing successful actions
  const receiptStatusMap = block
    .receipts()
    .filter(
      (receipt) =>
        receipt.receiverId.endsWith(BASE_ACCOUNT_ID) &&
        (receipt.status.hasOwnProperty("SuccessValue") ||
          receipt.status.hasOwnProperty("SuccessReceiptId"))
    )
    .map((receipt) => receipt.receiptId);

  console.log("let us see...", receiptStatusMap);

  // filter actions in this block whose receipts can be found in the list of successful receipts
  // const matchingTx = block.transactions.filter(
  //   (tx) => tx.receiverId.endsWith(BASE_ACCOUNT_ID) && tx.status
  // );
  // console.log(matchingTx);


  // filter actions in this block whose receipts can be found in the list of successful receipts
  const matchingActions = block
    .actions()
    .filter(
      (action) =>
        action.receiverId.endsWith(BASE_ACCOUNT_ID) &&
        receiptStatusMap.includes(action.receiptId)
    );

  console.log("macthing actions rambo=====", matchingActions);

  // if there are no actions matching our conditions, then we have nothing to index in this block, unto the next.
  if (!matchingActions.length) {
    console.log("nothin concerns us here");
    return;
  }

  const functionCallTracked = [
    "CREATE_ACCOUNT",
    "deploy_pot",
    "deploy_pot_callback",
    "register",
    "apply",
    "assert_can_apply_callback",
    "handle_apply",
    "challenge_payouts",
    "chef_set_payouts",
  ];

  async function handleNewPot(
    args,
    receiverId,
    signerId,
    predecessorId,
    receiptId
  ) {
    let data = JSON.parse(args);
    console.log("new pot data::", { ...data }, receiverId, signerId);
    await context.db.Account.upsert({ id: data.owner }, ["id"], []);
    await context.db.Account.upsert({ id: signerId }, ["id"], []);

    if (data.chef) {
      await context.db.Account.upsert({ id: data.chef }, ["id"], []);
    }

    if (data.admins) {
      for (const admin in data.admins) {
        await context.db.Account.upsert({ id: admin }, ["id"], []);
        let pot_admin = {
          pot_id: receiverId,
          admin_id: admin,
        };
        await context.db.PotAdmin.insert(pot_admin);
      }
    }

    const deploy_time = new Date(
      Number(BigInt(block.header().timestampNanosec) / BigInt(1000000))
    );

    const potObject = {
      id: receiverId,
      pot_factory_id: predecessorId,
      deployer_id: signerId,
      deployed_at: deploy_time,
      source_metadata: JSON.stringify(data.source_metadata),
      owner_id: data.owner,
      chef_id: data.chef,
      name: data.pot_name,
      description: data.pot_description,
      max_approved_applicants: data.max_projects,
      base_currency: null,
      application_start: new Date(data.application_start_ms),
      application_end: new Date(data.application_end_ms),
      matching_round_start: new Date(data.public_round_start_ms),
      matching_round_end: new Date(data.public_round_end_ms),
      registry_provider: data.registry_provider,
      min_matching_pool_donation_amount: data.min_matching_pool_donation_amount,
      sybil_wrapper_provider: data.sybil_wrapper_provider,
      custom_sybil_checks: data.custom_sybil_checks,
      custom_min_threshold_score: data.custom_min_threshold_score,
      referral_fee_matching_pool_basis_points:
        data.referral_fee_matching_pool_basis_points,
      referral_fee_public_round_basis_points:
        data.referral_fee_public_round_basis_points,
      chef_fee_basis_points: data.chef_fee_basis_points,
      total_matching_pool: data.total_matching_pool || "0",
      total_matching_pool_usd: data.total_matching_pool_usd,
      matching_pool_balance: data.matching_pool_balance || "0",
      matching_pool_donations_count: data.matching_pool_donations_count || 0,
      total_public_donations: data.total_public_donations || "0",
      total_public_donations_usd: data.total_public_donations_usd,
      public_donations_count: data.public_donations_count || 0,
      cooldown_end: data.cooldown_end,
      all_paid_out: false,
      protocol_config_provider: data.protocol_config_provider,
    };

    await context.db.Pot.insert(potObject);

    let activity = {
      signer_id: signerId,
      receiver_id: receiverId,
      timestamp: deploy_time,
      type: "Deploy_Pot",
      action_result: potObject.id,
      tx_hash: receiptId,
    };

    await context.db.Activity.insert(activity);
  }

  async function handleNewFactory(args, receiverId, signerId, receiptId) {
    let data = JSON.parse(args);
    console.log("new factory data::", { ...data }, receiverId);
    // try saving concerned accounts
    await context.db.Account.upsert({ id: data.owner }, ["id"], []);
    await context.db.Account.upsert(
      { id: data.protocol_fee_recipient_account },
      ["id"],
      []
    );
    if (data.admins) {
      for (const admin in data.admins) {
        await context.db.Account.upsert({ id: admin }, ["id"], []);
        let factory_admin = {
          pot_factory_id: receiverId,
          admin_id: admin,
        };
        await context.db.PotFactoryAdmin.insert(factory_admin);
      }
    }

    if (data.whitelisted_deployers) {
      for (const deployer in data.whitelisted_deployers) {
        await context.db.Account.upsert({ id: deployer }, ["id"], []);
        let factory_deployer = {
          pot_factory_id: receiverId,
          whitelisted_deployer_id: deployer,
        };
        await context.db.PotFactoryWhitelistedDeployer.insert(factory_deployer);
      }
    }

    const deploy_time = new Date(
      Number(BigInt(block.header().timestampNanosec) / BigInt(1000000))
    );
    const factory = {
      id: receiverId,
      owner_id: data.owner,
      deployed_at: deploy_time,
      source_metadata: JSON.stringify(data.source_metadata),
      protocol_fee_basis_points: data.protocol_fee_basis_points,
      protocol_fee_recipient_account: data.protocol_fee_recipient_account,
      require_whitelist: data.require_whitelist,
    };
    console.log("factory..", factory);
    await context.db.PotFactory.insert(factory);
  }

  // function tracks registry contracts, where projects are registered
  async function handleRegistry(args, receiverId, signerId, receiptId) {
    let data = JSON.parse(args);
    console.log("new Registry data::", { ...data }, receiverId);

    if (data.admins) {
      for (const admin in data.admins) {
        await context.db.Account.upsert({ id: admin }, ["id"], []);
        let list_admin = {
          list_id: receiverId,
          admin_id: admin,
        };
        await context.db.ListAdmin.insert(list_admin);
      }
    }

    let regv = {
      id: receiverId,
      owner_id: data.owner,
      default_registration_status: "Approved", // the first registry contract has approved as default, and the later changed through the admin set function call, which we also listen to, so it should self correct.
      name: receiverId.split(".")[0],
      tx_hash: receiptId,
    };


    await context.db.Account.upsert({ id: data.owner }, ["id"], []);

    await context.db.List.insert(regv);
  }

  // function tracks register function calls on the registry conract
  async function handleNewProject(args, receiverId, signerId, receiptId) {
    let data = JSON.parse(args);
    console.log("new Project data::", { ...data }, receiverId);
    let registry = (await context.db.List.select({ id: receiverId }))[0]; // fetch the registry so as to get default
    let reg = {
      registrant_id: data._project_id || signerId,
      status: registry.default_registration_status,
      submitted_at: new Date(
        Number(BigInt(block.header().timestampNanosec) / BigInt(1000000))
      ),
    };
    if (data._project_id) {
      await context.db.Account.upsert({ id: data._project_id }, ["id"], []);
    }

    await context.db.Account.upsert({ id: signerId }, ["id"], []);

    await context.db.ListRegistration.insert(reg);
    let activity = {
      signer_id: signerId,
      receiver_id: receiverId,
      timestamp: reg.submitted_at,
      type: "Register",
      action_result: reg.registrant_id,
      tx_hash: receiptId,
    };

    await context.db.Activity.insert(activity);
  }

  async function handleProjectRegistrationUpdate(
    args,
    receiverId,
    signerId,
    receiptId
  ) {
    let data = JSON.parse(args);
    console.log("new Project data::", { ...data }, receiverId);
    let regUpdate = {
      status: data.status,
      admin_notes: data.review_notes,
      updated_at: new Date(
        Number(BigInt(block.header().timestampNanosec) / BigInt(1000000))
      ),
    };

    await context.db.ListRegistration.update(
      { registrant_id: data.project_id },
      regUpdate
    );
  }

  async function handlePotApplication(args, receiverId, signerId, receiptId) {
    let data = JSON.parse(args);
    console.log("new factory data::", { ...data }, receiverId);
    await context.db.Account.upsert({ id: data.project_id }, ["id"], []);
    let application = {
      pot_id: receiverId,
      applicant_id: data.project_id,
      message: data.message,
      submitted_at: data.submitted_at,
      current_status: data.status,
      tx_hash: receiptId,
    };
    const appl = await context.db.PotApplication.insert(application);

    let activity = {
      signer_id: signerId,
      receiver_id: receiverId,
      timestamp: application.submitted_at,
      type: "Submit_Application",
      action_result: appl[0].id.toString(), // result points to the pot application created.
      tx_hash: receiptId, // should we have receipt on both action and activity?
    };

    await context.db.Activity.insert(activity);
  }

  async function handleApplicationStatusChange(
    args,
    receiverId,
    signerId,
    receiptId
  ) {
    let data = JSON.parse(args);
    console.log("new factory data::", { ...data }, receiverId);

    let receipt = block
      .receipts()
      .filter((receipt) => receipt.receiptId == receiptId)[0];
    let update_data = JSON.parse(atob(receipt.status["SuccessValue"]));
    let appl = (
      await context.db.PotApplication.select({ applicant_id: data.project_id })
    )[0];

    let applicationReview = {
      application_id: appl.id,
      reviewer_id: signerId,
      notes: update_data.notes,
      status: update_data.status,
      reviewed_at: update_data.updated_at,
    };
    let applicationUpdate = {
      current_status: update_data.status,
      last_updated_at: update_data.updated_at,
    };

    await context.db.PotApplicationReview.insert(applicationReview);
    await context.db.PotApplication.update({ id: appl.id }, applicationUpdate);
  }

  async function handleDefaultListStatusChange(
    args,
    receiverId,
    signerId,
    receiptId
  ) {
    let data = JSON.parse(args);
    console.log("update project data::", { ...data }, receiverId);

    let listUpdate = {
      default_registration_status: data.status,
    };

    await context.db.List.update({ id: receiverId }, listUpdate);
  }

  async function handleSettingPayout(args, receiverId, signerId, receiptId) {
    let data = JSON.parse(args);
    console.log("set payout data::", { ...data }, receiverId);
    let payouts = data.payouts;
    for (const payout in payouts) {
      // general question: should we register projects as accounts?
      let potPayout = {
        recipient_id: payout["project_id"],
        amount: payout["amount"],
        ft_id: payout["ft_id"] || null,
        tx_hash: receiptId,
      };
      await context.db.PotPayout.insert(potPayout);
    }
  }

  async function handlePayout(args, receiverId, signerId, receiptId) {
    let data = JSON.parse(args);
    console.log("fulfill payout data::", { ...data }, receiverId);
    let payout = {
      recipient_id: data.project_id,
      amount: data.amount,
      paid_at: data.paid_at,
      tx_hash: receiptId,
    };
    await context.db.PotPayout.update({ recipient_id: data.project_id }, payout);
  }

  async function handlePayoutChallenge(args, receiverId, signerId, receiptId) {
    let data = JSON.parse(args);
    console.log("set payout data::", { ...data }, receiverId);
    let payoutChallenge = {
      challenger_id: signerId,
      pot_id: receiverId,
      created_at: new Date(
        Number(BigInt(block.header().timestampNanosec) / BigInt(1000000)) // convert to ms then date
      ),
      message: data.reason,
      tx_hash: receiptId,
    };
    await context.db.PotPayoutChallenge.insert(payoutChallenge);
  }

  const GECKO_URL = "https://api.coingecko.com/api/v3";
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${day}-${month}-${year}`;
  }

  function formatToNear(yoctoAmount) {
    const nearAmount = yoctoAmount / 10 ** 24;
    return nearAmount;
  }

  async function handleNewDonations(
    args,
    receiverId,
    signerId,
    actionName,
    receiptId
  ) {
    let matching_pool = JSON.parse(args).matching_pool
    if ((actionName == "donate" && receiverId != "donate.potlock.near") || matching_pool) {
      console.log("calling donate on projects...");
      return;
    }
    console.log("action and recv", actionName, receiverId);
    let receipt = block
      .receipts()
      .filter((receipt) => receipt.receiptId == receiptId)[0];
    let donation_data = JSON.parse(atob(receipt.status["SuccessValue"]));
    console.log("result arg...:", donation_data);
    let donated_at = new Date(donation_data.donated_at || donation_data.donated_at_ms);
    await context.db.Account.upsert({ id: donation_data.donor_id }, ["id"], []);
    let endpoint = `${GECKO_URL}/coins/${
      donation_data.ft_id || "near"
    }/history?date=${formatDate(donated_at)}&localization=false`;
    let response = await fetch(endpoint);
    let data = await response.json();
    let unit_price = data.market_data?.current_price.usd;

    let total_amount = donation_data.total_amount;
    let net_amount = (
      BigInt(donation_data.total_amount) - BigInt(donation_data.protocol_fee)
    ).toString();

    let totalnearAMount = formatToNear(total_amount);
    let netnearAMount = formatToNear(net_amount);
    let total_amount_usd = unit_price * totalnearAMount
    let net_amount_usd = unit_price * netnearAMount

    console.log("feram..", unit_price, totalnearAMount, total_amount, net_amount, total_amount_usd, net_amount_usd)

    let donation = {
      donor_id: donation_data.donor_id,
      total_amount,
      total_amount_usd,
      net_amount_usd,
      net_amount,
      ft_id: donation_data.ft_id || null,
      message: donation_data.message,
      donated_at,
      matching_pool: donation_data.matching_pool || false,
      recipient_id: donation_data.project_id || donation_data.recipient_id,
      protocol_fee: donation_data.protocol_fee,
      referrer_id: donation_data.referrer_id,
      referrer_fee: donation_data.referrer_fee,
      tx_hash: receiptId,
    };
    await context.db.Donation.insert(donation);

    if (actionName != "donate") {
      let pot = (await context.db.Pot.select({ id: receiverId}))[0]
      donation["pot_id"] = pot.id
      let potUpdate = {
        total_public_donations_usd: pot.total_public_donations_usd || 0 + total_amount_usd,
        total_public_donations: pot.total_public_donations || 0 + total_amount,
      }
      if (donation_data.matching_pool) {
        potUpdate["total_matching_pool_usd"] = pot.total_matching_pool_usd || 0 + total_amount_usd
        potUpdate["total_matching_pool"] = pot.total_matching_pool || 0 + total_amount
        potUpdate["matching_pool_donations_count"] = pot.matching_pool_donations_count || 0 + 1
        let accountUpdate = {

        }
      } else {
        potUpdate["public_donations_count"] = pot.public_donations_count || 0 + 1
      }
      await context.db.Pot.update({id: pot.id}, potUpdate)
    }

    let recipient = donation_data.project_id || donation_data.recipient_id

    if (recipient) {
      let acct = (await context.db.Account.select({ id: recipient }))[0]
      console.log("selected acct", acct)
      let acctUpdate = {
        total_donations_usd: acct.total_donations_usd || 0 + total_amount_usd,
        donors_count: acct.donors_count || 0 + 1
      }
      await context.db.Account.update({ id: recipient }, acctUpdate)
    }

    let activity = {
      signer_id: signerId,
      receiver_id: receiverId,
      timestamp: donation.donated_at,
      type:
        actionName == "donate"
          ? "Donate_Direct"
          : donation.matching_pool
          ? "Donate_Pot_Matching_Pool"
            : "Donate_Pot_Public",
      action_result: recipient,
      tx_hash: receiptId,
    };

    await context.db.Activity.insert(activity);
  }

  // map through the successful actions and swittch on the methodName called for each, then call the designated handlerFunction.
  await Promise.all(
    matchingActions.flatMap((action) => {
      action.operations.map(async (operation) => {
        console.log("see the contents here...:,==", operation["FunctionCall"]);
        let call = operation["FunctionCall"];
        if (call) {
          const args = atob(call.args); // decode function call argument
          switch (call.methodName) {
            case "new":
            // new can be called on  a couple of things, if the recever id matches factory pattern, then it's a new factory, else if it matches the registry account id, then it's a registry contract initialization, else, it's a new pot initialization.
              matchVersionPattern(action.receiverId)
                ? await handleNewFactory(
                    args,
                    action.receiverId,
                    action.signerId,
                    action.receiptId
                  )
                : action.receiverId == "registry.potlock.near" // initializing registry
                ? await handleRegistry(
                    args,
                    action.receiverId,
                    action.signerId,
                    action.receiptId
                  )
                : await handleNewPot(
                    args,
                    action.receiverId,
                    action.signerId,
                    action.predecessorId,
                    action.receiptId
                  );
              break;
            // this is the callback after user applies to a certain pot, it can either be this or handle_apply
            case "assert_can_apply_callback":
              console.log("application case:", JSON.parse(args));
              await handlePotApplication(
                args,
                action.receiverId,
                action.signerId,
                action.receiptId
              );
              break;
            case "handle_apply":
              console.log("application case 2:", JSON.parse(args));
              break;
            
            // if function call is donate, call the handle new donations function
            case "donate":
              console.log("donatons to project incoming:", JSON.parse(args));
              await handleNewDonations(
                args,
                action.receiverId,
                action.signerId,
                "donate",
                action.receiptId
              );
              break;
            
            // this is a form of donation where user calls donate on a pot
            case "handle_protocol_fee_callback":
              console.log("donations to pool incoming:", JSON.parse(args));
              await handleNewDonations(
                args,
                action.receiverId,
                action.signerId,
                "handle_protocol_fee_callback",
                action.receiptId
              );
              break;
            // this handles project/list registration
            case "register":
              console.log("registrations incoming:", JSON.parse(args));
              await handleNewProject(
                args,
                action.receiverId,
                action.signerId,
                action.receiptId
              );
              break;
            
            // chefs approve/decline ... etc a projects application to a pot
            case "chef_set_application_status":
              console.log(
                "application status change incoming:",
                JSON.parse(args)
              );
              await handleApplicationStatusChange(
                args,
                action.receiverId,
                action.signerId,
                action.receiptId
              );
              break;
            
            // registries can have default status for projects
            case "admin_set_default_project_status":
              console.log(
                "registry default status setting incoming:",
                JSON.parse(args)
              );
              await handleDefaultListStatusChange(
                args,
                action.receiverId,
                action.signerId,
                action.receiptId
              );
              break;
            
            // admins can set a project's status
            case "admin_set_project_status":
              console.log(
                "project registration status update incoming:",
                JSON.parse(args)
              );
              await handleProjectRegistrationUpdate(
                args,
                action.receiverId,
                action.signerId,
                action.receiptId
              );
              break;
            
            // fires when chef set payouts
            case "chef_set_payouts":
              console.log(
                "setting payot....:",
                JSON.parse(args)
              );
              await handleSettingPayout(
                args,
                action.receiverId,
                action.signerId,
                action.receiptId
              );
              break;
            
            // fires when there is a payout challenge
            case "challenge_payouts":
              console.log(
                "challenge payout:",
                JSON.parse(args)
              );
              await handlePayoutChallenge(
                args,
                action.receiverId,
                action.signerId,
                action.receiptId
              );
              break;
            // fires when fulfilling payouts
            case "transfer_payout_callback":
              console.log(
                "fulfilling payouts.....",
                JSON.parse(args)
              );
              await handlePayout(
                args,
                action.receiverId,
                action.signerId,
                action.receiptId
              );
              break;
          }
        }
      });
    })
  );
}
