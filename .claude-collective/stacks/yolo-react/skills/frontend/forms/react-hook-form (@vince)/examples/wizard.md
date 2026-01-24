# React Hook Form - Multi-Step Wizard

> Wizard form pattern with step-by-step validation. See [core.md](core.md) for basic form patterns.

**Prerequisites:** Understand Basic Forms, Controller, and Resolver patterns from [core.md](core.md), [controlled-components.md](controlled-components.md), and [validation.md](validation.md) first.

---

## Pattern 6: Multi-Step Wizard Form

### Good Example - Wizard form with step validation

```typescript
import { useState } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { SubmitHandler } from "react-hook-form";
import type { z } from "zod";
import { wizardSchema, step1Schema, step2Schema, step3Schema } from "./schemas/wizard";

type WizardFormData = z.infer<typeof wizardSchema>;

const TOTAL_STEPS = 3;
const FIRST_STEP = 1;

export function WizardForm() {
  const [currentStep, setCurrentStep] = useState(FIRST_STEP);

  const methods = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    mode: "onBlur",
    defaultValues: {
      // Step 1
      firstName: "",
      lastName: "",
      email: "",
      // Step 2
      company: "",
      role: "",
      teamSize: "",
      // Step 3
      plan: "basic",
      billingCycle: "monthly",
    },
  });

  const onSubmit: SubmitHandler<WizardFormData> = async (data) => {
    await submitWizard(data);
  };

  const handleNext = async () => {
    // Validate only current step's fields
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isStepValid = await methods.trigger(fieldsToValidate);

    if (isStepValid) {
      setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, FIRST_STEP));
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {/* Progress indicator */}
        <div>
          Step {currentStep} of {TOTAL_STEPS}
        </div>

        {/* Step content */}
        {currentStep === 1 && <Step1 />}
        {currentStep === 2 && <Step2 />}
        {currentStep === 3 && <Step3 />}

        {/* Navigation */}
        <div>
          {currentStep > FIRST_STEP && (
            <button type="button" onClick={handleBack}>
              Back
            </button>
          )}

          {currentStep < TOTAL_STEPS ? (
            <button type="button" onClick={handleNext}>
              Next
            </button>
          ) : (
            <button type="submit">Submit</button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}

function getFieldsForStep(step: number): (keyof WizardFormData)[] {
  switch (step) {
    case 1:
      return ["firstName", "lastName", "email"];
    case 2:
      return ["company", "role", "teamSize"];
    case 3:
      return ["plan", "billingCycle"];
    default:
      return [];
  }
}

// Step components use useFormContext
function Step1() {
  const { register, formState: { errors } } = useFormContext<WizardFormData>();

  return (
    <div>
      <h2>Personal Information</h2>
      <input {...register("firstName")} placeholder="First name" />
      {errors.firstName && <span>{errors.firstName.message}</span>}

      <input {...register("lastName")} placeholder="Last name" />
      {errors.lastName && <span>{errors.lastName.message}</span>}

      <input {...register("email")} type="email" placeholder="Email" />
      {errors.email && <span>{errors.email.message}</span>}
    </div>
  );
}

function Step2() {
  const { register, formState: { errors } } = useFormContext<WizardFormData>();

  return (
    <div>
      <h2>Company Information</h2>
      <input {...register("company")} placeholder="Company name" />
      {errors.company && <span>{errors.company.message}</span>}

      <input {...register("role")} placeholder="Your role" />
      {errors.role && <span>{errors.role.message}</span>}

      <select {...register("teamSize")}>
        <option value="">Select team size</option>
        <option value="1-10">1-10</option>
        <option value="11-50">11-50</option>
        <option value="51-200">51-200</option>
        <option value="200+">200+</option>
      </select>
      {errors.teamSize && <span>{errors.teamSize.message}</span>}
    </div>
  );
}

function Step3() {
  const { register, formState: { errors } } = useFormContext<WizardFormData>();

  return (
    <div>
      <h2>Select Your Plan</h2>
      <div>
        <label>
          <input {...register("plan")} type="radio" value="basic" />
          Basic
        </label>
        <label>
          <input {...register("plan")} type="radio" value="pro" />
          Pro
        </label>
        <label>
          <input {...register("plan")} type="radio" value="enterprise" />
          Enterprise
        </label>
      </div>
      {errors.plan && <span>{errors.plan.message}</span>}

      <div>
        <label>
          <input {...register("billingCycle")} type="radio" value="monthly" />
          Monthly
        </label>
        <label>
          <input {...register("billingCycle")} type="radio" value="annual" />
          Annual (save 20%)
        </label>
      </div>
      {errors.billingCycle && <span>{errors.billingCycle.message}</span>}
    </div>
  );
}
```

**Why good:** trigger() validates only specific fields for step-by-step validation, FormProvider enables nested step components to access form, form state persists across steps, named constants for TOTAL_STEPS and FIRST_STEP, getFieldsForStep centralizes field mapping

---
