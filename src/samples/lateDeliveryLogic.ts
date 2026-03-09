const MODEL = `namespace io.clause.latedeliveryandpenalty@0.1.0

import org.accordproject.time@0.3.0.{Duration, TemporalUnit} from https://models.accordproject.org/time@0.3.0.cto

import org.accordproject.contract@0.2.0.Clause from https://models.accordproject.org/accordproject/contract@0.2.0.cto
import org.accordproject.runtime@0.2.0.{Request,Response} from https://models.accordproject.org/accordproject/runtime@0.2.0.cto

/**
 * Defines the data model for the LateDeliveryAndPenalty template.
 */
@template
asset TemplateModel extends Clause {
  o Boolean forceMajeure
  o Duration penaltyDuration
  o Double penaltyPercentage
  o Double capPercentage
  o Duration termination
  o TemporalUnit fractionalPart
}

/**
 * Defines the input data required by the template
 */
transaction LateDeliveryAndPenaltyRequest extends Request {
  o Boolean forceMajeure
  o DateTime agreedDelivery
  o DateTime deliveredAt optional
  o Double goodsValue
}

/**
 * Defines the output data for the template
 */
transaction LateDeliveryAndPenaltyResponse extends Response {
  o Double penalty
  o Boolean buyerMayTerminate
}`;

const TEMPLATE = `Late Delivery and Penalty – {{% return now.toLocaleString() %}}
----

In case of delayed delivery{{#if forceMajeure}}, except for Force Majeure cases,{{/if}} the Seller shall pay to the Buyer for every _{{% return \`\${penaltyDuration.amount} \${penaltyDuration.unit}\` %}} of delay_ ***Penalty*** amounting to {{penaltyPercentage}}% of the total value of the Equipment whose delivery has been delayed.

1. Any fractional part of a {{fractionalPart}} is to be considered a full {{fractionalPart}}.
1. The total amount of penalty shall not however, exceed {{capPercentage}}% of the total value of the Equipment involved in late delivery.
1. If the delay is more than {{% return \`\${termination.amount} \${termination.unit}\` %}}, the Buyer is entitled to terminate this Contract.`;

const DATA = {
  $class: "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel",
  forceMajeure: true,
  penaltyDuration: {
    $class: "org.accordproject.time@0.3.0.Duration",
    amount: 2,
    unit: "days",
  },
  penaltyPercentage: 10.5,
  capPercentage: 55,
  termination: {
    $class: "org.accordproject.time@0.3.0.Duration",
    amount: 15,
    unit: "days",
  },
  fractionalPart: "days",
  clauseId: "c88e5ed7-c3e0-4249-a99c-ce9278684ac8",
  $identifier: "c88e5ed7-c3e0-4249-a99c-ce9278684ac8",
};

// Exact logic from demo-template/archives/latedeliveryandpenalty-typescript/logic/logic.ts
// The ONLY difference: no import statements (logicExecutor.ts prepends all types).
const LOGIC = `// demo utility function
function calc(input: number) : number {
    const result = input * 2.5;
    return result;
}

type LateDeliveryContractResponse = {
    result: ILateDeliveryAndPenaltyResponse;
}

// sample contract logic that is stateless
// - no init method
// @ts-ignore
class LateDeliveryLogic extends TemplateLogic<ITemplateModel>  {
    async trigger(data: ITemplateModel, request:ILateDeliveryAndPenaltyRequest) : Promise<LateDeliveryContractResponse> {
        return {
            result: {
                penalty: data.penaltyPercentage * calc(request.goodsValue),
                buyerMayTerminate: true,
                $timestamp: new Date(),
                $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyResponse'
            }
        }
    }
}

export default LateDeliveryLogic;
`;

// Matches the request object constructed in demo-template/index.js line 33-35
const REQUEST = JSON.stringify(
  {
    goodsValue: 100,
  },
  null,
  2
);

const NAME = "Late Delivery & Penalty (Logic)";

export { NAME, MODEL, TEMPLATE, DATA, LOGIC, REQUEST };
