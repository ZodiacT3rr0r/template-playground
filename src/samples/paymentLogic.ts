const MODEL = `namespace io.accordproject.paymentapproval@1.0.0

import org.accordproject.contract@0.2.0.Contract from https://models.accordproject.org/accordproject/contract@0.2.0.cto
import org.accordproject.runtime@0.2.0.{Request,Response,State,Obligation} from https://models.accordproject.org/accordproject/runtime@0.2.0.cto

@template
asset TemplateModel extends Contract {
  o String buyer
  o String seller
  o Double approvalLimit
  o String currency
}

transaction PaymentApprovalRequest extends Request {
  o Double amount
  o String reference
  o String approver
}

transaction PaymentApprovalResponse extends Response {
  o Boolean approved
  o Double approvedAmount
  o String reason
}

asset PaymentApprovalState extends State {
  o Integer approvalsCount
  o Double totalApproved
}

event PaymentApprovedEvent {
  o String reference
  o Boolean approved
}

event PaymentDueObligation extends Obligation {
  o String reference
  o Double amount
}`;

const TEMPLATE = `Payment approval placeholder template.`;

const LOGIC = `type PaymentTriggerResponse = {
  result: IPaymentApprovalResponse;
  state: IPaymentApprovalState;
  events: IPaymentApprovedEvent[];
  obligations: IPaymentDueObligation[];
};

// @ts-ignore
class PaymentApprovalLogic extends TemplateLogic<ITemplateModel, IPaymentApprovalState> {
  // @ts-ignore
  async init(data: ITemplateModel): Promise<InitResponse<IPaymentApprovalState>> {
    return {
      state: {
        $class: "io.accordproject.paymentapproval@1.0.0.PaymentApprovalState",
        $identifier: data.$identifier,
        approvalsCount: 0,
        totalApproved: 0,
      },
    };
  }

  async trigger(
    data: ITemplateModel,
    request: IPaymentApprovalRequest,
    state: IPaymentApprovalState,
  ): Promise<PaymentTriggerResponse> {
    const approved = request.amount <= data.approvalLimit;
    const approvedAmount = approved ? request.amount : 0;
    const nextCount = state.approvalsCount + 1;

    return {
      result: {
        $class: "io.accordproject.paymentapproval@1.0.0.PaymentApprovalResponse",
        $timestamp: new Date().toISOString(),
        approved,
        approvedAmount,
        reason: approved ? "Within approval limit" : "Exceeds approval limit",
      },
      state: {
        $class: "io.accordproject.paymentapproval@1.0.0.PaymentApprovalState",
        $identifier: state.$identifier,
        approvalsCount: nextCount,
        totalApproved: state.totalApproved + approvedAmount,
      },
      events: [{
        $class: "io.accordproject.paymentapproval@1.0.0.PaymentApprovedEvent",
        $timestamp: new Date().toISOString(),
        reference: request.reference,
        approved,
      }],
      obligations: approved ? [{
        $class: "io.accordproject.paymentapproval@1.0.0.PaymentDueObligation",
          $timestamp: new Date().toISOString(),
        $identifier: \`obligation-\${nextCount}\`,
        contract: \`resource:org.accordproject.contract@0.2.0.Contract#\${data.contractId}\`,
        reference: request.reference,
        amount: approvedAmount,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }] : [],
    };
  }
}

export default PaymentApprovalLogic;`;

const DATA = {
  $class: "io.accordproject.paymentapproval@1.0.0.TemplateModel",
  $identifier: "payment-contract-001",
  contractId: "payment-contract-001",
  buyer: "Acme Corp",
  seller: "Supply Co",
  approvalLimit: 1000,
  currency: "USD",
};

const REQUEST = {
  amount: 500,
  reference: "INV-2026-001",
  approver: "alice@example.com",
};

const NAME = "Payment Approval";

export { NAME, MODEL, TEMPLATE, LOGIC, DATA, REQUEST };
