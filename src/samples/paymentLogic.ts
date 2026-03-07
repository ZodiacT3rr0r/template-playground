const MODEL = `namespace org.accordproject.payment@1.0.0

import org.accordproject.contract@0.2.0.Contract from https://models.accordproject.org/accordproject/contract@0.2.0.cto
import org.accordproject.runtime@0.2.0.{Request,Response,State} from https://models.accordproject.org/accordproject/runtime@0.2.0.cto

/**
 * Payment approval contract parameters
 */
@template
asset TemplateModel extends Contract {
  o String buyer
  o String seller
  o Double approvalThreshold
}

/**
 * A payment request from the buyer
 */
transaction PaymentRequest extends Request {
  o Double amount
  o String description
}

/**
 * The contract's response to a payment request
 */
transaction PaymentResponse extends Response {
  o Boolean approved
  o String message
  o Double amount
}

/**
 * Tracks total approved and rejected payment amounts
 */
asset PaymentState extends State {
  o Double totalApproved
  o Double totalRejected
  o Integer approvedCount
  o Integer rejectedCount
}`;

const TEMPLATE = `# Payment Approval Contract

This contract governs payments between **{{buyer}}** (Buyer) and **{{seller}}** (Seller).

Any payment request up to and including **\${{approvalThreshold}}** is automatically approved. Amounts exceeding this threshold are automatically rejected.`;

const DATA = {
  $class: "org.accordproject.payment@1.0.0.TemplateModel",
  $identifier: "payment-contract-001",
  contractId: "payment-contract-001",
  buyer: "Acme Corp",
  seller: "SupplyCo Ltd",
  approvalThreshold: 10000,
};

const LOGIC = `class PaymentApprovalLogic extends TemplateLogic<ITemplateModel> {

  async init(data: ITemplateModel): Promise<InitResponse<IPaymentState>> {
    return {
      state: {
        $class: "org.accordproject.payment@1.0.0.PaymentState",
        $identifier: data.$identifier,
        totalApproved: 0,
        totalRejected: 0,
        approvedCount: 0,
        rejectedCount: 0,
      }
    };
  }

  async trigger(data: ITemplateModel, request: IPaymentRequest, state: IPaymentState): Promise<TriggerResponse<IPaymentState>> {
    const approved = request.amount <= data.approvalThreshold;

    const newState = {
      ...state,
      totalApproved: approved
        ? state.totalApproved + request.amount
        : state.totalApproved,
      totalRejected: !approved
        ? state.totalRejected + request.amount
        : state.totalRejected,
      approvedCount: approved ? state.approvedCount + 1 : state.approvedCount,
      rejectedCount: !approved ? state.rejectedCount + 1 : state.rejectedCount,
    };

    const response = {
      $class: "org.accordproject.payment@1.0.0.PaymentResponse",
      $timestamp: new Date(),
      approved,
      amount: request.amount,
      message: approved
        ? \`Payment of \$\${request.amount} approved. Description: \${request.description}\`
        : \`Payment of \$\${request.amount} exceeds threshold of \$\${data.approvalThreshold} and was rejected.\`,
    };

    return { result: response, state: newState, events: [] };
  }
}

export default PaymentApprovalLogic;
`;

const REQUEST = JSON.stringify(
  {
    $class: "org.accordproject.payment@1.0.0.PaymentRequest",
    $timestamp: "2024-01-01T00:00:00.000Z",
    amount: 5000,
    description: "Office supplies for Q1",
  },
  null,
  2
);

const NAME = "Payment Approval (Logic)";

export { NAME, MODEL, TEMPLATE, DATA, LOGIC, REQUEST };
