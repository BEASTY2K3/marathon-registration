const API_BASE_URL = "http://marathonapi.bhoganmediasoft.com/api";

document.getElementById("registrationForm").addEventListener("submit", async (e) => {
  e.preventDefault(); // ✅ Prevent default form submission

  const formData = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    age: document.getElementById("age").value.trim(),
    gender: document.getElementById("gender").value,
    category: document.getElementById("category").value,
  };

  try {
    console.log("🔄 Fetching Razorpay Key...");
    const keyResponse = await fetch(`${API_BASE_URL}/get-razorpay-key`);
    if (!keyResponse.ok) throw new Error("Failed to fetch Razorpay key");
    const { key } = await keyResponse.json();

    console.log("🔄 Creating Order...");
    const orderResponse = await fetch(`${API_BASE_URL}/createOrder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 499 }), // Adjust amount if needed
    });

    const order = await orderResponse.json();
    if (!order.id) {
      alert("Error creating order. Please try again.");
      return;
    }

    console.log("✅ Order Created:", order);

    const options = {
      key: key,
      amount: order.amount,
      currency: "INR",
      name: "Polo Marathon",
      description: "Marathon Registration Fee",
      order_id: order.id,
      handler: async function (response) {
        console.log("🔍 Razorpay Payment Response:", response);
        if (!response.razorpay_payment_id) {
          alert("Payment failed or cancelled. Please try again.");
          return;
        }

        console.log("🔄 Sending Registration Data...");
        const saveResponse = await fetch(`${API_BASE_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            paymentId: response.razorpay_payment_id || "N/A",
            orderId: response.razorpay_order_id || "N/A",
            signature: response.razorpay_signature || "N/A",
          }),
        });

        const result = await saveResponse.json();
        if (!saveResponse.ok) {
          alert("Registration failed: " + result.msg);
          return;
        }

        alert("🎉 Registration and Payment Successful!");
        document.getElementById("registrationForm").reset();
      },
      prefill: {
        name: formData.name,
        email: formData.email,
        contact: formData.phone,
      },
      theme: { color: "#3399cc" },
    };

    const razorpay = new Razorpay(options);
    razorpay.open();
  } catch (error) {
    console.error("❌ Payment Error:", error);
    alert("An error occurred. Please try again later.");
  }
});
